import {
  addDoc,
  deleteDoc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  countFacultyFitTests,
  countFitTestsForUser,
  deleteFitTest,
  ensureFitTestVerification,
  FACULTY_RESULTS_LIMIT,
  getFacultyFitTests,
  getFitTestCountsByUser,
  getUserFitTests,
  lookupFitTestForResend,
  updateFitTest,
  lookupFitTestForVerification,
  saveFitTest,
} from './firebaseDb';

const userDoc = (role, extra = {}) => ({
  exists: () => true,
  data: () => ({
    role,
    status: 'approved',
    schools: role === 'admin' ? ['Helene College of Nursing'] : [],
    ...extra,
  }),
});

const NOW = new Date(2026, 9, 24, 12, 0, 0);
const recentCreatedAt = { toDate: () => new Date(2026, 9, 20, 8, 0, 0) };

const fitTestDoc = (id, issueDate) => ({
  id,
  ref: { id },
  data: () => ({
    userId: 'tester-1',
    issueDate,
    createdAt: recentCreatedAt,
  }),
});

const reproDocs = [
  fitTestDoc('live-1', '10/24/2026'),
  fitTestDoc('live-2', '01/15/2025'),
  fitTestDoc('old-issue', '10/23/2022'),
];

beforeEach(() => {
  getDoc.mockReset();
  getDocs.mockReset();
  where.mockClear();
  orderBy.mockClear();
  limit.mockClear();
  addDoc.mockClear();
  getCountFromServer.mockClear();
  writeBatch.mockReset();
  writeBatch.mockImplementation(() => ({
    delete: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    commit: jest.fn(async () => {}),
  }));
  updateDoc.mockClear();
  deleteDoc.mockClear();
  addDoc.mockClear();
  getDocs.mockResolvedValue({ docs: [] });
});

test('counts match the results list for 2 live records plus a 4-year-old issue date', async () => {
  getDoc.mockResolvedValue(userDoc('admin'));
  getDocs.mockImplementation(async (q) => {
    const userConstraint = (q?.args || []).find((arg) => arg?.kind === 'where' && arg.field === 'userId');
    if (userConstraint?.value === 'tester-2') return { docs: [] };
    return { docs: reproDocs };
  });

  const listed = await getUserFitTests('tester-1', { now: NOW });
  expect(listed.map((record) => record.id).sort()).toEqual(['live-1', 'live-2']);
  expect(writeBatch).not.toHaveBeenCalled();

  await expect(countFitTestsForUser('tester-1', { now: NOW })).resolves.toBe(2);

  expect(where).toHaveBeenCalledWith('userId', '==', 'tester-1');
  expect(where).not.toHaveBeenCalledWith('createdAt', '<', expect.anything());
});

test('admin user counts use an aggregate query instead of downloading each list', async () => {
  getDoc.mockResolvedValue(userDoc('admin'));
  getCountFromServer.mockImplementation(async (q) => {
    const userConstraint = (q?.args || []).find((arg) => arg?.kind === 'where' && arg.field === 'userId');
    if (userConstraint?.value === 'tester-1') return { data: () => ({ count: 3 }) };
    return { data: () => ({ count: 0 }) };
  });

  await expect(getFitTestCountsByUser('admin-1', ['tester-1', 'tester-2', 'tester-1'])).resolves.toEqual({
    'tester-1': 3,
  });
  expect(getCountFromServer).toHaveBeenCalled();
  expect(getDocs).not.toHaveBeenCalled();
});

test('getUserFitTests does not write lookup or verification documents', async () => {
  getDocs.mockResolvedValue({
    docs: [{
      id: 'ft-1',
      data: () => ({
        userId: 'tester-1',
        clientName: 'Test Person',
        issueDate: '10/24/2026',
        createdAt: { toDate: () => new Date('2026-10-24T00:00:00.000Z') },
      }),
    }],
  });

  const records = await getUserFitTests('tester-1', { now: NOW });

  expect(records.map((record) => record.id)).toEqual(['ft-1']);
  expect(writeBatch).not.toHaveBeenCalled();
});

test('a missing composite index is surfaced instead of an empty results list', async () => {
  const indexError = new Error(
    'The query requires an index. You can create it here: https://console.firebase.google.com/example'
  );
  indexError.code = 'failed-precondition';
  getDocs.mockRejectedValue(indexError);

  await expect(getUserFitTests('tester-1', { now: NOW })).rejects.toMatchObject({
    message: 'FIREBASE_INDEX_REQUIRED',
    indexUrl: 'https://console.firebase.google.com/example',
  });
  await expect(countFitTestsForUser('tester-1', { now: NOW })).rejects.toBe(indexError);
});

test('an allowed edit writes history and a result change does not', async () => {
  updateDoc.mockClear();
  addDoc.mockClear();
  writeBatch.mockClear();
  const stored = {
    userId: 'tester-1',
    clientName: 'Ada Lovelace',
    recipientEmail: 'ada@example.com',
    dob: '01/01/1990',
    result: 'Pass',
    issueDate: '01/15/2026',
    expirationDate: '01/15/2027',
    model: '1860',
  };
  getDoc.mockImplementation(async (ref) => {
    const name = ref?.args?.[1];
    if (name === 'users') return userDoc('admin');
    if (name === 'fitTests') {
      return { exists: () => true, data: () => stored };
    }
    return { exists: () => false, data: () => null };
  });

  await expect(updateFitTest('ft-1', { result: 'Fail', model: '1870' }, 'admin-1'))
    .rejects.toThrow(/cannot be changed/);
  await expect(updateFitTest('ft-1', { expirationDate: '02/02/2027' }, 'admin-1'))
    .rejects.toThrow(/cannot be changed/);
  await expect(updateFitTest('ft-1', { retentionDate: { seconds: 1 } }, 'admin-1'))
    .rejects.toThrow(/cannot be changed/);
  expect(updateDoc).not.toHaveBeenCalled();
  expect(addDoc).not.toHaveBeenCalled();
  expect(writeBatch).not.toHaveBeenCalled();

  await updateFitTest('ft-1', { model: '1870', result: 'Pass', expirationDate: '01/15/2027' }, 'admin-1');

  expect(updateDoc).not.toHaveBeenCalled();
  expect(addDoc).not.toHaveBeenCalled();
  expect(writeBatch).toHaveBeenCalledTimes(1);
  const batch = writeBatch.mock.results[0].value;
  expect(batch.commit).toHaveBeenCalledTimes(1);
  const written = batch.update.mock.calls[0][1];
  expect(written.model).toBe('1870');
  expect(written.fitTestMethod).toBe('Qualitative');
  expect(written.fitFactor).toBeUndefined();
  expect(written.result).toBeUndefined();
  expect(written.issueDate).toBeUndefined();
  expect(written.expirationDate).toBeUndefined();
  expect(written.retentionDate).toBeUndefined();
  expect(written.lastEditId).toEqual(expect.stringMatching(/^[a-f0-9]{32}$/));
  expect(written.updatedAt).toEqual({ kind: 'serverTimestamp' });
  expect(batch.set.mock.calls[0][0].args.slice(1)).toEqual([
    'fitTests',
    'ft-1',
    'editHistory',
    written.lastEditId,
  ]);
  expect(batch.set.mock.calls[0][1]).toEqual({
    fitTestId: 'ft-1',
    editedBy: 'admin-1',
    editedAt: { kind: 'serverTimestamp' },
    fields: ['model', 'fitTestMethod'],
    changes: {
      old: { model: '1860', fitTestMethod: null },
      new: { model: '1870', fitTestMethod: 'Qualitative' },
    },
  });
});

test('soft-deleted fit tests stay stored and drop out of normal lists', async () => {
  const hidden = {
    id: 'hidden-1',
    data: () => ({
      userId: 'tester-1',
      issueDate: '10/24/2026',
      createdAt: recentCreatedAt,
      deletedAt: { toDate: () => new Date('2026-10-24T00:00:00.000Z') },
    }),
  };
  getDocs.mockResolvedValue({ docs: [...reproDocs, hidden] });
  getDoc.mockResolvedValue(userDoc('admin'));

  const listed = await getUserFitTests('tester-1', { now: NOW });
  expect(listed.map((record) => record.id).sort()).toEqual(['live-1', 'live-2']);
  await expect(countFitTestsForUser('tester-1', { now: NOW })).resolves.toBe(2);

  getDoc.mockImplementation(async (ref) => {
    if (ref?.args?.[1] === 'users') return userDoc('admin');
    return {
      exists: () => true,
      id: ref?.args?.[2],
      data: () => ({
        userId: 'tester-1',
        clientName: 'Ada',
        schoolsList: 'Helene College of Nursing',
      }),
    };
  });
  await deleteFitTest('live-1', 'admin-1', ' Entered on the wrong person ');
  expect(deleteDoc).not.toHaveBeenCalled();
  expect(updateDoc).not.toHaveBeenCalled();
  expect(addDoc).not.toHaveBeenCalled();
  expect(writeBatch).toHaveBeenCalledTimes(1);
  const batch = writeBatch.mock.results[0].value;
  expect(batch.commit).toHaveBeenCalledTimes(1);
  expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    deletedBy: 'admin-1',
    deleteReason: 'Entered on the wrong person',
    deletedAt: { kind: 'serverTimestamp' },
  }));
  const logWrite = batch.set.mock.calls[0];
  const noteDelete = batch.delete.mock.calls.find((call) => call[0].args[1] === 'fitTestMedicalNotes');
  expect(noteDelete[0].args.slice(1)).toEqual(['fitTestMedicalNotes', 'live-1']);
  expect(logWrite[0].args.slice(1)).toEqual(['fitTestDeletionLogs', 'live-1']);
  expect(logWrite[1]).toEqual(expect.objectContaining({
    fitTestId: 'live-1',
    userId: 'tester-1',
    schoolsList: 'Helene College of Nursing',
    deletedBy: 'admin-1',
    deleteReason: 'Entered on the wrong person',
    deletedAt: { kind: 'serverTimestamp' },
  }));

  writeBatch.mockClear();
  await expect(deleteFitTest('live-1', 'admin-1', '   ')).rejects.toThrow(/reason is required/i);
  expect(writeBatch).not.toHaveBeenCalled();
});

test('a scoped admin cannot soft-delete a fit test outside their schools', async () => {
  getDoc.mockImplementation(async (ref) => {
    if (ref?.args?.[1] === 'users') return userDoc('admin');
    return {
      exists: () => true,
      data: () => ({ userId: 'tester-1', schoolsList: 'Example Second School' }),
    };
  });

  await expect(deleteFitTest('live-1', 'admin-1', 'Wrong school')).rejects.toMatchObject({
    code: 'PERMISSION_DENIED',
  });
  expect(writeBatch).not.toHaveBeenCalled();
  expect(deleteDoc).not.toHaveBeenCalled();
});

test('resend skips a revoked lookup and verify reports the card revoked', async () => {
  getDoc.mockResolvedValue({
    exists: () => true,
    id: 'lookup',
    data: () => ({
      clientName: 'Ada Lovelace',
      dob: '01/02/1990',
      recipientEmail: 'ada@example.com',
      revokedAt: { toDate: () => new Date('2026-10-25T00:00:00.000Z') },
    }),
  });

  await expect(lookupFitTestForResend('Ada Lovelace', '01/02/1990', 'ada@example.com')).resolves.toBeNull();

  getDoc.mockResolvedValue({
    exists: () => true,
    id: 'token',
    data: () => ({
      clientName: 'Ada Lovelace',
      result: 'Pass',
      revokedAt: { toDate: () => new Date('2026-10-25T00:00:00.000Z') },
    }),
  });
  await expect(lookupFitTestForVerification('ab'.repeat(16))).resolves.toEqual({
    status: 'revoked',
    card: null,
  });
});

test('saveFitTest stamps the creator profile and ignores a client stamp', async () => {
  getDoc.mockResolvedValue(userDoc('tester', { school: 'Helene College of Nursing' }));
  await saveFitTest('tester-1', {
    schoolsList: 'Other School',
    creatorRole: 'admin',
    creatorSchool: 'Spoofed',
  });
  const savedWrite = writeBatch.mock.results[0].value.set.mock.calls
    .find((call) => call[0].args[1] === 'fitTests');
  const saved = savedWrite[1];
  expect(addDoc).not.toHaveBeenCalled();
  expect(saved.creatorRole).toBe('tester');
  expect(saved.creatorSchool).toBe('Helene College of Nursing');
  expect(saved.schoolsList).toBe('Other School');
  expect(saved.deletedAt).toBeNull();

  writeBatch.mockClear();
  addDoc.mockClear();
  getDoc.mockResolvedValue(userDoc('admin'));
  await saveFitTest('admin-1', { schoolsList: 'Helene College of Nursing', creatorSchool: 'Spoofed' });
  const adminWrite = writeBatch.mock.results[0].value.set.mock.calls
    .find((call) => call[0].args[1] === 'fitTests');
  expect(adminWrite[1]).toEqual(expect.objectContaining({
    creatorRole: 'admin',
    creatorSchool: 'Helene College of Nursing',
  }));
});

test('updateFitTest keeps a legacy quantitative method and fit factor', async () => {
  const update = jest.fn();
  writeBatch.mockReturnValue({
    delete: jest.fn(),
    update,
    set: jest.fn(),
    commit: async () => {},
  });
  getDoc.mockImplementation(async () => ({ exists: () => false, data: () => null }));
  getDoc
    .mockResolvedValueOnce(userDoc('admin'))
    .mockResolvedValueOnce({
      exists: () => true,
      id: 'ft-1',
      data: () => ({
        userId: 'tester-1',
        fitTestMethod: 'Quantitative',
        fitFactor: 180,
        clientName: 'Ada',
      }),
    });

  await updateFitTest('ft-1', {
    clientName: 'Ada Lovelace',
    fitTestMethod: 'Qualitative',
    fitFactor: { kind: 'deleteField' },
  }, 'admin-1');

  expect(update).toHaveBeenCalledWith(expect.anything(), expect.any(Object));
  const written = update.mock.calls[0][1];
  expect(written.fitTestMethod).toBeUndefined();
  expect(written.fitFactor).toBeUndefined();
  expect(written.clientName).toBe('Ada Lovelace');
});

test('updateFitTest does not add a fit factor to a quantitative record that has none', async () => {
  const update = jest.fn();
  writeBatch.mockReturnValue({
    delete: jest.fn(),
    update,
    set: jest.fn(),
    commit: async () => {},
  });
  getDoc.mockImplementation(async () => ({ exists: () => false, data: () => null }));
  getDoc
    .mockResolvedValueOnce(userDoc('admin'))
    .mockResolvedValueOnce({
      exists: () => true,
      id: 'ft-1',
      data: () => ({
        userId: 'tester-1',
        fitTestMethod: 'Quantitative',
        clientName: 'Ada',
      }),
    });

  await updateFitTest('ft-1', {
    clientName: 'Ada Lovelace',
    fitTestMethod: 'Qualitative',
    fitFactor: 200,
  }, 'admin-1');

  const written = update.mock.calls[0][1];
  expect(written.clientName).toBe('Ada Lovelace');
  expect(written).not.toHaveProperty('fitTestMethod');
  expect(written).not.toHaveProperty('fitFactor');
});

test('updateFitTest still records a non-quantitative edit as qualitative with no fit factor', async () => {
  const update = jest.fn();
  writeBatch.mockReturnValue({
    delete: jest.fn(),
    update,
    set: jest.fn(),
    commit: async () => {},
  });
  getDoc.mockImplementation(async () => ({ exists: () => false, data: () => null }));
  getDoc
    .mockResolvedValueOnce(userDoc('admin'))
    .mockResolvedValueOnce({
      exists: () => true,
      id: 'ft-1',
      data: () => ({
        userId: 'tester-1',
        fitTestMethod: 'Locked to Qualitative',
        fitFactor: 100,
        clientName: 'Ada',
      }),
    });

  await updateFitTest('ft-1', {
    clientName: 'Ada Lovelace',
    fitFactor: 100,
  }, 'admin-1');

  expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    fitTestMethod: 'Qualitative',
    fitFactor: { kind: 'deleteField' },
  }));
});

test('faculty cannot create a fit test', async () => {
  getDoc.mockResolvedValue(userDoc('faculty', { school: 'Helene College of Nursing' }));
  await expect(saveFitTest('faculty-1', { schoolsList: 'Helene College of Nursing' })).rejects.toThrow(
    /faculty cannot create/i
  );
  expect(addDoc).not.toHaveBeenCalled();
});

test('faculty results read only the profile school, newest first, with a limit', async () => {
  getDocs.mockResolvedValue({ docs: [] });
  await getFacultyFitTests('Helene College of Nursing');
  expect(where).toHaveBeenCalledWith('creatorSchool', '==', 'Helene College of Nursing');
  expect(where).toHaveBeenCalledWith('deletedAt', '==', null);
  expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  expect(limit).toHaveBeenCalledWith(FACULTY_RESULTS_LIMIT);
  expect(getDocs).toHaveBeenCalledTimes(1);

  where.mockClear();
  getDocs.mockClear();
  await getFacultyFitTests({
    school: 'Helene College of Nursing',
    schools: ['Example Second School'],
  });
  expect(where).toHaveBeenCalledWith('creatorSchool', '==', 'Helene College of Nursing');
  expect(where).not.toHaveBeenCalledWith('creatorSchool', 'in', expect.anything());
  expect(getDocs).toHaveBeenCalledTimes(1);

  where.mockClear();
  getDocs.mockClear();
  await getFacultyFitTests(['Helene College of Nursing', 'Example Second School']);
  expect(getDocs).not.toHaveBeenCalled();
});

test('a missing faculty index is surfaced instead of an empty list', async () => {
  const indexError = new Error(
    'The query requires an index. You can create it here: https://console.firebase.google.com/faculty'
  );
  indexError.code = 'failed-precondition';
  getDocs.mockRejectedValue(indexError);

  await expect(getFacultyFitTests({ school: 'Helene College of Nursing', schools: ['Other'] })).rejects.toMatchObject({
    message: 'FIREBASE_INDEX_REQUIRED',
    indexUrl: 'https://console.firebase.google.com/faculty',
  });
  expect(where).toHaveBeenCalledWith('creatorSchool', '==', 'Helene College of Nursing');
});

test('a tester with no profile school cannot save a fit test', async () => {
  getDoc.mockResolvedValue(userDoc('tester', { school: '  ' }));
  await expect(saveFitTest('tester-1', {
    schoolsList: 'Helene College of Nursing',
    creatorSchool: 'Helene College of Nursing',
  })).rejects.toThrow(/school is required on your profile/i);
  expect(addDoc).not.toHaveBeenCalled();
});

test('an admin stamp must be one of that admin\'s schools', async () => {
  getDoc.mockResolvedValue(userDoc('admin'));
  await expect(saveFitTest('admin-1', { schoolsList: 'Example Second School' }))
    .rejects.toThrow(/one of your schools/i);
  expect(addDoc).not.toHaveBeenCalled();
});

test('faculty outside the access window do not query results', async () => {
  getDocs.mockClear();
  await expect(getFacultyFitTests({
    role: 'faculty',
    school: 'Helene College of Nursing',
    endDate: '2020-01-01T00:00:00.000Z',
  })).resolves.toEqual([]);
  await expect(getFacultyFitTests({
    role: 'faculty',
    school: 'Helene College of Nursing',
    startDate: '2099-01-01T00:00:00.000Z',
  })).resolves.toEqual([]);
  expect(getDocs).not.toHaveBeenCalled();
});

test('faculty sidebar count uses the same limit and retention filter as the list', async () => {
  getDocs.mockResolvedValue({
    docs: [
      {
        id: 'live',
        data: () => ({
          creatorSchool: 'Helene College of Nursing',
          issueDate: '10/24/2026',
          createdAt: recentCreatedAt,
        }),
      },
      {
        id: 'old',
        data: () => ({
          creatorSchool: 'Helene College of Nursing',
          issueDate: '10/23/2022',
          createdAt: recentCreatedAt,
        }),
      },
    ],
  });

  await expect(countFacultyFitTests({
    school: 'Helene College of Nursing',
    schools: ['Example Second School'],
  }, { now: NOW })).resolves.toBe(1);
  expect(where).toHaveBeenCalledWith('creatorSchool', '==', 'Helene College of Nursing');
  expect(where).toHaveBeenCalledWith('deletedAt', '==', null);
  expect(where).not.toHaveBeenCalledWith('creatorSchool', 'in', expect.anything());
  expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  expect(limit).toHaveBeenCalledWith(FACULTY_RESULTS_LIMIT);
  expect(getCountFromServer).not.toHaveBeenCalled();
});

test('faculty lists and counts skip soft-deleted records', async () => {
  getDocs.mockResolvedValue({
    docs: [
      {
        id: 'live',
        data: () => ({
          creatorSchool: 'Helene College of Nursing',
          issueDate: '10/24/2026',
          createdAt: recentCreatedAt,
        }),
      },
      {
        id: 'hidden',
        data: () => ({
          creatorSchool: 'Helene College of Nursing',
          issueDate: '10/24/2026',
          createdAt: recentCreatedAt,
          deletedAt: { toDate: () => new Date('2026-10-24T00:00:00.000Z') },
        }),
      },
    ],
  });

  const listed = await getFacultyFitTests({ school: 'Helene College of Nursing' }, { now: NOW });
  expect(listed.map((record) => record.id)).toEqual(['live']);
  await expect(countFacultyFitTests({
    school: 'Helene College of Nursing',
  }, { now: NOW })).resolves.toBe(1);
});

test('medical restriction notes are stored apart from the fit test and preferred on read', async () => {
  getDoc.mockResolvedValue(userDoc('tester', { school: 'Helene College of Nursing' }));
  await saveFitTest('tester-1', {
    clientName: 'Ada Lovelace',
    schoolsList: 'Helene College of Nursing',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: '  asthma  ',
  });

  expect(addDoc).not.toHaveBeenCalled();
  expect(writeBatch).toHaveBeenCalledTimes(1);
  const batch = writeBatch.mock.results[0].value;
  expect(batch.commit).toHaveBeenCalledTimes(1);
  const fitWrite = batch.set.mock.calls.find((call) => call[0].args[1] === 'fitTests');
  const noteWrite = batch.set.mock.calls.find((call) => call[0].args[1] === 'fitTestMedicalNotes');
  expect(fitWrite[1].testerMedicalRestrictionsReceived).toBeUndefined();
  expect(fitWrite[1].testerMedicalRestrictionsNote).toBeUndefined();
  expect(fitWrite[1].fitTestMethod).toBe('Qualitative');
  expect(fitWrite[1].fitFactor).toBeUndefined();
  expect(noteWrite[0].args.slice(1)).toEqual(['fitTestMedicalNotes', fitWrite[0].args[2]]);
  expect(noteWrite[1]).toEqual(expect.objectContaining({
    fitTestId: fitWrite[0].args[2],
    userId: 'tester-1',
    updatedBy: 'tester-1',
    schoolsList: 'Helene College of Nursing',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'asthma',
  }));

  const fitDocs = [
    {
      id: 'ft-1',
      data: () => ({
        userId: 'tester-1',
        issueDate: '10/24/2026',
        createdAt: recentCreatedAt,
        testerMedicalRestrictionsReceived: false,
        testerMedicalRestrictionsNote: 'legacy',
      }),
    },
    {
      id: 'ft-2',
      data: () => ({
        userId: 'tester-1',
        issueDate: '10/24/2026',
        createdAt: recentCreatedAt,
        testerMedicalRestrictionsReceived: false,
        testerMedicalRestrictionsNote: 'kept on the old record',
      }),
    },
  ];
  const notes = {
    docs: [{
      id: 'ft-1',
      data: () => ({
        userId: 'tester-1',
        testerMedicalRestrictionsReceived: true,
        testerMedicalRestrictionsNote: 'side note',
      }),
    }],
  };
  getDocs.mockImplementation(async (q) => {
    const path = q?.args?.[0]?.path;
    if (path === 'fitTestMedicalNotes') return notes;
    return { docs: fitDocs };
  });

  const listed = await getUserFitTests('tester-1', { now: NOW });
  const byId = Object.fromEntries(listed.map((record) => [record.id, record]));
  expect(byId['ft-1'].testerMedicalRestrictionsReceived).toBe(true);
  expect(byId['ft-1'].testerMedicalRestrictionsNote).toBe('side note');
  expect(byId['ft-2'].testerMedicalRestrictionsReceived).toBeUndefined();
  expect(byId['ft-2'].testerMedicalRestrictionsNote).toBeUndefined();
});

test('a failed medical-notes read still returns fit tests without inline notes', async () => {
  const fitDocs = [{
    id: 'ft-1',
    data: () => ({
      userId: 'tester-1',
      issueDate: '10/24/2026',
      createdAt: recentCreatedAt,
      testerMedicalRestrictionsReceived: true,
      testerMedicalRestrictionsNote: 'legacy inline',
    }),
  }];
  getDocs.mockImplementation(async (q) => {
    const path = q?.args?.[0]?.path;
    if (path === 'fitTestMedicalNotes') throw new Error('notes unavailable');
    return { docs: fitDocs };
  });

  const listed = await getUserFitTests('tester-1', { now: NOW });

  expect(listed).toHaveLength(1);
  expect(listed[0].id).toBe('ft-1');
  expect(listed[0].testerMedicalRestrictionsReceived).toBeUndefined();
  expect(listed[0].testerMedicalRestrictionsNote).toBeUndefined();
});

test('an in-scope admin edit moves a legacy inline note off the fit test without history', async () => {
  writeBatch.mockClear();
  const stored = {
    userId: 'tester-1',
    schoolsList: 'Helene College of Nursing',
    clientName: 'Ada Lovelace',
    fitTestMethod: 'Qualitative',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'legacy inline',
  };
  getDoc.mockImplementation(async (ref) => {
    const name = ref?.args?.[1];
    if (name === 'users') return userDoc('admin');
    if (name === 'fitTests') return { exists: () => true, data: () => stored };
    return { exists: () => false, data: () => null };
  });

  await updateFitTest('ft-1', {
    clientName: 'Ada Lovelace',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: '  updated note  ',
  }, 'admin-1');

  const batch = writeBatch.mock.results[0].value;
  expect(batch.commit).toHaveBeenCalledTimes(1);
  const payload = batch.update.mock.calls[0][1];
  expect(payload.testerMedicalRestrictionsReceived).toEqual({ kind: 'deleteField' });
  expect(payload.testerMedicalRestrictionsNote).toEqual({ kind: 'deleteField' });
  expect(payload.clientName).toBeUndefined();
  const historyWrite = batch.set.mock.calls.find((call) => call[0].args.includes('editHistory'));
  expect(historyWrite).toBeUndefined();
  const noteWrite = batch.set.mock.calls.find((call) => call[0].args[1] === 'fitTestMedicalNotes');
  expect(batch.set.mock.invocationCallOrder[0]).toBeLessThan(batch.update.mock.invocationCallOrder[0]);
  expect(noteWrite[1]).toEqual(expect.objectContaining({
    fitTestId: 'ft-1',
    userId: 'tester-1',
    updatedBy: 'admin-1',
    schoolsList: 'Helene College of Nursing',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'updated note',
  }));
});

test('an admin outside the record school does not clear legacy inline notes', async () => {
  const stored = {
    userId: 'tester-1',
    schoolsList: 'Helene College of Nursing',
    model: '1860',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'legacy inline',
  };
  getDoc.mockImplementation(async (ref) => {
    const name = ref?.args?.[1];
    if (name === 'users') return userDoc('admin', { schools: ['Example Second School'] });
    if (name === 'fitTests') return { exists: () => true, data: () => stored };
    return { exists: () => false, data: () => null };
  });

  await updateFitTest('ft-1', { model: '1870' }, 'admin-1');
  const batch = writeBatch.mock.results[0].value;
  const payload = batch.update.mock.calls[0][1];
  expect(payload.testerMedicalRestrictionsReceived).toBeUndefined();
  expect(payload.testerMedicalRestrictionsNote).toBeUndefined();
  expect(payload.model).toBe('1870');
});

test('token refresh on a style-less record writes the lookup key and keeps the owner', async () => {
  const stored = {
    userId: 'tester-1',
    schoolsList: 'Helene College of Nursing',
    clientName: 'Legacy Plain',
    dob: '03/03/1981',
    recipientEmail: 'legacy-plain@example.com',
    result: 'Pass',
    respiratorMfg: '3M',
    model: '1860',
    maskSize: 'Regular',
    fitTestMethod: 'Qualitative',
  };
  getDoc.mockResolvedValue({ exists: () => false, data: () => null });
  setDoc.mockClear();

  const next = await ensureFitTestVerification({ id: 'legacy-plain', ...stored }, 'admin-1');

  expect(next.verificationToken).toMatch(/^[a-f0-9]{32}$/);
  expect(updateDoc).toHaveBeenCalledTimes(1);
  const patch = updateDoc.mock.calls[0][1];
  expect(patch.verificationToken).toBe(next.verificationToken);
  expect(patch.lookupKey).toEqual(expect.any(String));
  expect(patch.lookupKey.length).toBeGreaterThan(0);
  expect(patch).not.toHaveProperty('style');
  const writes = setDoc.mock.calls.map((call) => call[1]);
  expect(writes).toEqual(expect.arrayContaining([
    expect.objectContaining({ userId: 'tester-1', fitTestId: 'legacy-plain' }),
  ]));
  expect(writes.every((write) => write.userId === 'tester-1')).toBe(true);
});

const PROGRAM_ADMIN = {
  programAdministratorName: 'Ada Admin',
  programAdministratorContact: 'ada-admin@example.com',
};

test('saveFitTest carries program administrator fields to the resend lookup and verification', async () => {
  getDoc.mockImplementation(async (ref) => (
    ref?.args?.[1] === 'users'
      ? userDoc('tester', { school: 'Helene College of Nursing' })
      : { exists: () => false, data: () => null }
  ));
  setDoc.mockClear();

  await saveFitTest('tester-1', {
    clientName: 'Ada Lovelace',
    dob: '01/02/1990',
    recipientEmail: 'ada@example.com',
    schoolsList: 'Helene College of Nursing',
    result: 'Pass',
    ...PROGRAM_ADMIN,
  });

  const writeTo = (collectionName) => setDoc.mock.calls
    .find((call) => call[0].args[1] === collectionName)?.[1];
  expect(writeTo('fitTestLookups')).toEqual(expect.objectContaining(PROGRAM_ADMIN));
  expect(writeTo('fitTestVerifications')).toEqual(expect.objectContaining(PROGRAM_ADMIN));
});

test('a verification refresh keeps the stored program administrator fields', async () => {
  getDoc.mockResolvedValue({ exists: () => false, data: () => null });
  setDoc.mockClear();

  await ensureFitTestVerification({
    id: 'ft-program',
    userId: 'tester-1',
    clientName: 'Ada Lovelace',
    dob: '01/02/1990',
    recipientEmail: 'ada@example.com',
    result: 'Pass',
    ...PROGRAM_ADMIN,
  }, 'tester-1');

  const writeTo = (collectionName) => setDoc.mock.calls
    .find((call) => call[0].args[1] === collectionName)?.[1];
  expect(writeTo('fitTestLookups')).toEqual(expect.objectContaining(PROGRAM_ADMIN));
  expect(writeTo('fitTestVerifications')).toEqual(expect.objectContaining(PROGRAM_ADMIN));
});

test('resend and verify lookups return the program administrator fields on file', async () => {
  getDoc.mockResolvedValue({
    exists: () => true,
    id: 'lookup',
    data: () => ({
      clientName: 'Ada Lovelace',
      dob: '01/02/1990',
      recipientEmail: 'ada@example.com',
      result: 'Pass',
      ...PROGRAM_ADMIN,
    }),
  });
  await expect(lookupFitTestForResend('Ada Lovelace', '01/02/1990', 'ada@example.com'))
    .resolves.toEqual(expect.objectContaining(PROGRAM_ADMIN));

  getDoc.mockResolvedValue({
    exists: () => true,
    id: 'token',
    data: () => ({
      clientName: 'Ada Lovelace',
      result: 'Pass',
      expirationDate: '01/01/2099',
      ...PROGRAM_ADMIN,
    }),
  });
  const verified = await lookupFitTestForVerification('ab'.repeat(16));
  expect(verified.card).toEqual(expect.objectContaining(PROGRAM_ADMIN));
});

const liveFitTestForDelete = (ref) => {
  if (ref?.args?.[1] === 'users') return userDoc('admin');
  if (ref?.args?.[1] === 'fitTests') {
    return {
      exists: () => true,
      id: ref?.args?.[2],
      data: () => ({
        userId: 'tester-1',
        clientName: 'Ada',
        schoolsList: 'Helene College of Nursing',
      }),
    };
  }
  return { exists: () => false, data: () => null };
};

test('a soft delete that Firestore rejects keeps the Firestore error code', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  getDoc.mockImplementation(async (ref) => liveFitTestForDelete(ref));
  const denied = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  writeBatch.mockImplementation(() => ({
    delete: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    commit: jest.fn(async () => { throw denied; }),
  }));

  const attempt = deleteFitTest('live-1', 'admin-1', 'Duplicate entry');
  await expect(attempt).rejects.toThrow(
    'Failed to delete fit test record (permission-denied). Please try again.'
  );
  await expect(attempt).rejects.toMatchObject({ code: 'permission-denied' });
  expect(consoleError).toHaveBeenCalledWith('Error deleting fit test:', denied);
  consoleError.mockRestore();
});

test('a soft delete that fails without a Firestore code keeps the generic message', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  getDoc.mockImplementation(async (ref) => liveFitTestForDelete(ref));
  writeBatch.mockImplementation(() => ({
    delete: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    commit: jest.fn(async () => { throw new Error('boom'); }),
  }));

  await expect(deleteFitTest('live-1', 'admin-1', 'Duplicate entry')).rejects.toThrow(
    /^Failed to delete fit test record\. Please try again\.$/
  );
  consoleError.mockRestore();
});

test('a legacy Quantitative record carries its fit factor to the lookup, verification, and verify page', async () => {
  getDoc.mockImplementation(async (ref) => (
    ref?.args?.[1] === 'users'
      ? userDoc('tester', { school: 'Helene College of Nursing' })
      : { exists: () => false, data: () => null }
  ));
  setDoc.mockClear();

  await ensureFitTestVerification({
    id: 'ft-quant',
    userId: 'tester-1',
    clientName: 'Ada Lovelace',
    dob: '01/02/1990',
    recipientEmail: 'ada@example.com',
    result: 'Pass',
    fitTestMethod: 'Quantitative',
    fitFactor: 180,
  }, 'tester-1');

  const writeTo = (collectionName) => setDoc.mock.calls
    .find((call) => call[0].args[1] === collectionName)?.[1];
  expect(writeTo('fitTestLookups')).toEqual(expect.objectContaining({ fitFactor: 180 }));
  expect(writeTo('fitTestVerifications')).toEqual(expect.objectContaining({ fitFactor: 180 }));

  getDoc.mockResolvedValue({
    exists: () => true,
    id: 'token',
    data: () => ({
      clientName: 'Ada Lovelace',
      issueDate: '01/15/2026',
      expirationDate: '01/15/2099',
      result: 'Pass',
      fitTestMethod: 'Quantitative',
      fitFactor: 180,
    }),
  });
  const verified = await lookupFitTestForVerification('ab'.repeat(16));
  expect(verified.card).toEqual(expect.objectContaining({ fitTestMethod: 'Quantitative', fitFactor: 180 }));
});

test('a qualitative record writes card copies without a fit factor', async () => {
  getDoc.mockImplementation(async (ref) => (
    ref?.args?.[1] === 'users'
      ? userDoc('tester', { school: 'Helene College of Nursing' })
      : { exists: () => false, data: () => null }
  ));
  setDoc.mockClear();

  await ensureFitTestVerification({
    id: 'ft-qual',
    userId: 'tester-1',
    clientName: 'Ada Lovelace',
    dob: '01/02/1990',
    recipientEmail: 'ada@example.com',
    result: 'Pass',
    fitTestMethod: 'Qualitative',
  }, 'tester-1');

  const writes = setDoc.mock.calls.map((call) => call[1]);
  expect(writes.length).toBeGreaterThan(0);
  writes.forEach((write) => expect(write).not.toHaveProperty('fitFactor'));
});

test('a soft delete never reads the medical note and deletes it in the batch', async () => {
  // Records with no note doc failed here: the note get rule reads resource.data,
  // which errors on a missing doc and came back as permission-denied.
  getDoc.mockImplementation(async (ref) => {
    if (ref?.args?.[1] === 'fitTestMedicalNotes') {
      throw Object.assign(new Error('Null value error.'), { code: 'permission-denied' });
    }
    return liveFitTestForDelete(ref);
  });

  await deleteFitTest('live-1', 'admin-1', 'Duplicate entry');

  const noteReads = getDoc.mock.calls.filter((call) => call[0]?.args?.[1] === 'fitTestMedicalNotes');
  expect(noteReads).toHaveLength(0);
  const batch = writeBatch.mock.results[0].value;
  expect(batch.commit).toHaveBeenCalledTimes(1);
  const noteDelete = batch.delete.mock.calls.find((call) => call[0].args[1] === 'fitTestMedicalNotes');
  expect(noteDelete[0].args.slice(1)).toEqual(['fitTestMedicalNotes', 'live-1']);
});

test('card copies from a record holding a deleteField sentinel never carry it into setDoc', async () => {
  getDoc.mockImplementation(async (ref) => (
    ref?.args?.[1] === 'users'
      ? userDoc('tester', { school: 'Helene College of Nursing' })
      : { exists: () => false, data: () => null }
  ));
  setDoc.mockClear();

  const returned = await ensureFitTestVerification({
    id: 'ft-edited',
    userId: 'tester-1',
    clientName: 'Ada Lovelace',
    dob: '01/02/1990',
    recipientEmail: 'ada@example.com',
    result: 'Pass',
    fitTestMethod: 'Qualitative',
    fitFactor: { kind: 'deleteField' },
  }, 'tester-1');

  const hasSentinel = (value) => Object.values(value || {}).some((field) => (
    field && typeof field === 'object' && field.kind === 'deleteField'
  ));
  const cardWrites = setDoc.mock.calls.filter((call) => (
    ['fitTestLookups', 'fitTestVerifications'].includes(call[0].args[1])
  ));
  expect(cardWrites).toHaveLength(2);
  cardWrites.forEach((call) => {
    expect(call[1]).not.toHaveProperty('fitFactor');
    expect(hasSentinel(call[1])).toBe(false);
  });
  expect(returned).not.toHaveProperty('fitFactor');
});
