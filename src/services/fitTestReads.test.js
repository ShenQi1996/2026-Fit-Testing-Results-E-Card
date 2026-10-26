import {
  addDoc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  countFacultyFitTests,
  countFitTestsForUser,
  FACULTY_RESULTS_LIMIT,
  getFacultyFitTests,
  getFitTestCountsByUser,
  getUserFitTests,
  saveFitTest,
  updateFitTest,
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

test('updateFitTest keeps a legacy quantitative method and fit factor', async () => {
  const update = jest.fn();
  writeBatch.mockReturnValue({
    delete: jest.fn(),
    update,
    set: jest.fn(),
    commit: async () => {},
  });
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

  expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    clientName: 'Ada Lovelace',
    fitTestMethod: 'Quantitative',
    fitFactor: 180,
  }));
});

test('updateFitTest does not add a fit factor to a quantitative record that has none', async () => {
  const update = jest.fn();
  writeBatch.mockReturnValue({
    delete: jest.fn(),
    update,
    set: jest.fn(),
    commit: async () => {},
  });
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
  expect(written.fitTestMethod).toBe('Quantitative');
  expect(written.fitFactor).toBeUndefined();
});

test('updateFitTest still records a non-quantitative edit as qualitative with no fit factor', async () => {
  const update = jest.fn();
  writeBatch.mockReturnValue({
    delete: jest.fn(),
    update,
    set: jest.fn(),
    commit: async () => {},
  });
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
