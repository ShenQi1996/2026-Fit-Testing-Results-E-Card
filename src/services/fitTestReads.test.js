import { addDoc, getDoc, getDocs, updateDoc, where, writeBatch } from 'firebase/firestore';
import {
  countFitTestsForUser,
  getFitTestCountsByUser,
  getUserFitTests,
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

test('an allowed edit writes history and a result change does not', async () => {
  updateDoc.mockClear();
  addDoc.mockClear();
  const stored = {
    userId: 'tester-1',
    clientName: 'Ada Lovelace',
    recipientEmail: 'ada@example.com',
    dob: '01/01/1990',
    result: 'Pass',
    issueDate: '01/15/2026',
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
  expect(updateDoc).not.toHaveBeenCalled();
  expect(addDoc).not.toHaveBeenCalled();

  await updateFitTest('ft-1', { model: '1870', result: 'Pass' }, 'admin-1');

  expect(updateDoc).toHaveBeenCalledTimes(1);
  const written = updateDoc.mock.calls[0][1];
  expect(written.model).toBe('1870');
  expect(written.result).toBeUndefined();
  expect(written.issueDate).toBeUndefined();
  expect(addDoc).toHaveBeenCalledTimes(1);
  expect(addDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
    fitTestId: 'ft-1',
    editedBy: 'admin-1',
    changes: [{ field: 'model', oldValue: '1860', newValue: '1870' }],
  }));
});
