import {
  addDoc,
  deleteDoc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  countFacultyFitTests,
  countFitTestsForUser,
  deleteFitTest,
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
  writeBatch.mockClear();
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
  await expect(getFitTestCountsByUser('admin-1', ['tester-1', 'tester-2', 'tester-1'], { now: NOW })).resolves.toEqual({
    'tester-1': 2,
  });

  expect(where).toHaveBeenCalledWith('userId', '==', 'tester-1');
  expect(where).not.toHaveBeenCalledWith('createdAt', '<', expect.anything());
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
  const saved = addDoc.mock.calls[0][1];
  expect(saved.creatorRole).toBe('tester');
  expect(saved.creatorSchool).toBe('Helene College of Nursing');
  expect(saved.schoolsList).toBe('Other School');
  expect(saved.deletedAt).toBeNull();

  addDoc.mockClear();
  getDoc.mockResolvedValue(userDoc('admin'));
  await saveFitTest('admin-1', { schoolsList: 'Helene College of Nursing', creatorSchool: 'Spoofed' });
  expect(addDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
    creatorRole: 'admin',
    creatorSchool: 'Helene College of Nursing',
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
