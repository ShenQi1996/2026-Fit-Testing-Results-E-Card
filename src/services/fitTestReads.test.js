import { addDoc, deleteDoc, getDoc, getDocs, updateDoc, where, writeBatch } from 'firebase/firestore';
import {
  countFitTestsForUser,
  deleteFitTest,
  getFitTestCountsByUser,
  getUserFitTests,
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
      data: () => ({ userId: 'tester-1', clientName: 'Ada' }),
    };
  });
  await deleteFitTest('live-1', 'admin-1', ' Entered on the wrong person ');
  expect(deleteDoc).not.toHaveBeenCalled();
  expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    deletedBy: 'admin-1',
    deleteReason: 'Entered on the wrong person',
  }));
  expect(addDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
    fitTestId: 'live-1',
    userId: 'tester-1',
    deletedBy: 'admin-1',
    deleteReason: 'Entered on the wrong person',
  }));

  updateDoc.mockClear();
  addDoc.mockClear();
  await expect(deleteFitTest('live-1', 'admin-1', '   ')).rejects.toThrow(/reason is required/i);
  expect(updateDoc).not.toHaveBeenCalled();
  expect(addDoc).not.toHaveBeenCalled();
});
