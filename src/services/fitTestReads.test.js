import { getDoc, getDocs, limit, orderBy, where, writeBatch } from 'firebase/firestore';
import {
  FIT_TEST_PURGE_INTERVAL_MS,
  FIT_TEST_PURGE_LIMIT,
  FIT_TEST_PURGE_STORAGE_KEY,
  countFitTestsForUser,
  getFitTestCountsByUser,
  getUserFitTests,
  purgeExpiredFitTests,
} from './firebaseDb';

const memoryStorage = (initial = {}) => {
  const values = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null),
    setItem: (key, value) => {
      values[key] = String(value);
    },
    values,
  };
};

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
  writeBatch.mockClear();
  getDocs.mockResolvedValue({ docs: [] });
});

test('purgeExpiredFitTests skips Firestore when this browser ran it within 24 hours', async () => {
  const storage = memoryStorage({
    [FIT_TEST_PURGE_STORAGE_KEY]: String(Date.now() - 60 * 60 * 1000),
  });

  await expect(purgeExpiredFitTests('admin-1', { storage })).resolves.toBe(0);
  expect(getDocs).not.toHaveBeenCalled();
});

test('a scoped admin purge stays inside that admin\'s schools and stores the run', async () => {
  getDoc.mockResolvedValue(userDoc('admin'));
  const storage = memoryStorage();

  await expect(purgeExpiredFitTests('admin-1', { storage, now: NOW })).resolves.toBe(0);

  expect(where).toHaveBeenCalledWith('schoolsList', 'in', ['Helene College of Nursing']);
  expect(where).toHaveBeenCalledWith('retentionDate', '<', expect.objectContaining({ kind: 'timestamp' }));
  expect(orderBy).toHaveBeenCalledWith('retentionDate', 'asc');
  expect(limit).toHaveBeenCalledWith(FIT_TEST_PURGE_LIMIT);
  expect(where).not.toHaveBeenCalledWith('createdAt', '<', expect.anything());
  const stamp = Number(storage.values[FIT_TEST_PURGE_STORAGE_KEY]);
  expect(stamp).toBe(NOW.getTime());

  getDocs.mockClear();
  await purgeExpiredFitTests('admin-1', { storage, now: new Date(NOW.getTime() + 1000) });
  expect(getDocs).not.toHaveBeenCalled();
  expect(FIT_TEST_PURGE_INTERVAL_MS).toBe(24 * 60 * 60 * 1000);
});

test('a scoped admin with no schools does not scan fit tests', async () => {
  getDoc.mockResolvedValue(userDoc('admin', { schools: [] }));
  const storage = memoryStorage();

  await expect(purgeExpiredFitTests('admin-1', { storage, now: NOW })).resolves.toBe(0);

  expect(getDocs).not.toHaveBeenCalled();
  expect(Number(storage.values[FIT_TEST_PURGE_STORAGE_KEY])).toBe(NOW.getTime());
});

test('a super admin purge orders by retentionDate and does not use createdAt as the cutoff', async () => {
  getDoc.mockResolvedValue(userDoc('superadmin'));
  const storage = memoryStorage();

  await purgeExpiredFitTests('super-1', { storage, now: NOW });

  expect(orderBy).toHaveBeenCalledWith('retentionDate', 'asc');
  expect(where).toHaveBeenCalledWith('retentionDate', '<', expect.objectContaining({ kind: 'timestamp' }));
  expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  expect(where).not.toHaveBeenCalledWith('schoolsList', 'in', expect.anything());
  expect(where).not.toHaveBeenCalledWith('createdAt', '<', expect.anything());
});

test('a tester purge is limited to that user and orders by the retention field', async () => {
  getDoc.mockResolvedValue(userDoc('tester'));
  const storage = memoryStorage();

  await purgeExpiredFitTests('tester-1', { storage, now: NOW });

  expect(where).toHaveBeenCalledWith('userId', '==', 'tester-1');
  expect(where).toHaveBeenCalledWith('retentionDate', '<', expect.objectContaining({ kind: 'timestamp' }));
  expect(orderBy).toHaveBeenCalledWith('retentionDate', 'asc');
  expect(limit).toHaveBeenCalledWith(FIT_TEST_PURGE_LIMIT);
  expect(where).not.toHaveBeenCalledWith('createdAt', '<', expect.anything());
  expect(where).not.toHaveBeenCalledWith('schoolsList', 'in', expect.anything());
});

test('a failed purge still records the last run so the next load does not retry', async () => {
  getDoc.mockResolvedValue(userDoc('tester'));
  getDocs.mockRejectedValue(new Error('offline'));
  const storage = memoryStorage();

  await expect(purgeExpiredFitTests('tester-1', { storage, now: NOW })).resolves.toBe(0);
  expect(Number(storage.values[FIT_TEST_PURGE_STORAGE_KEY])).toBe(NOW.getTime());

  getDocs.mockClear();
  await purgeExpiredFitTests('tester-1', { storage, now: new Date(NOW.getTime() + 1000) });
  expect(getDocs).not.toHaveBeenCalled();
});

test('purge deletes a 4-year-old issue date even when createdAt is recent', async () => {
  getDoc.mockResolvedValue(userDoc('tester'));
  getDocs.mockResolvedValue({ docs: reproDocs });
  const storage = memoryStorage();

  await expect(purgeExpiredFitTests('tester-1', { storage, now: NOW })).resolves.toBe(1);
  expect(writeBatch).toHaveBeenCalled();
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
