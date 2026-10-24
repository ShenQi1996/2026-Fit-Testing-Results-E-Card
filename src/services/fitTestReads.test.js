import { getCountFromServer, getDoc, getDocs, limit, setDoc, where } from 'firebase/firestore';
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

const userDoc = (role) => ({
  exists: () => true,
  data: () => ({ role, status: 'approved', schools: ['Helene College of Nursing'] }),
});

beforeEach(() => {
  getDoc.mockReset();
  getDocs.mockReset();
  getCountFromServer.mockReset();
  where.mockClear();
  limit.mockClear();
  getDocs.mockResolvedValue({ docs: [] });
  getCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
});

test('purgeExpiredFitTests skips Firestore when this browser ran it within 24 hours', async () => {
  const storage = memoryStorage({
    [FIT_TEST_PURGE_STORAGE_KEY]: String(Date.now() - 60 * 60 * 1000),
  });

  await expect(purgeExpiredFitTests('admin-1', { storage })).resolves.toBe(0);
  expect(getDocs).not.toHaveBeenCalled();
});

test('an admin purge queries createdAt before the retention cutoff and stores the run', async () => {
  getDoc.mockResolvedValue(userDoc('admin'));
  const storage = memoryStorage();
  const now = new Date('2026-10-24T00:00:00.000Z');

  await expect(purgeExpiredFitTests('admin-1', { storage, now })).resolves.toBe(0);

  expect(where).toHaveBeenCalledWith('createdAt', '<', expect.objectContaining({ kind: 'timestamp' }));
  expect(limit).toHaveBeenCalledWith(FIT_TEST_PURGE_LIMIT);
  expect(where).not.toHaveBeenCalledWith('userId', '==', 'admin-1');
  const stamp = Number(storage.values[FIT_TEST_PURGE_STORAGE_KEY]);
  expect(stamp).toBe(now.getTime());

  getDocs.mockClear();
  await purgeExpiredFitTests('admin-1', { storage, now: new Date(now.getTime() + 1000) });
  expect(getDocs).not.toHaveBeenCalled();
  expect(FIT_TEST_PURGE_INTERVAL_MS).toBe(24 * 60 * 60 * 1000);
});

test('a tester purge is limited to that user and does not scan every fit test', async () => {
  getDoc.mockResolvedValue(userDoc('tester'));
  const storage = memoryStorage();

  await purgeExpiredFitTests('tester-1', { storage, now: new Date('2026-10-24T00:00:00.000Z') });

  expect(where).toHaveBeenCalledWith('userId', '==', 'tester-1');
  expect(limit).toHaveBeenCalledWith(FIT_TEST_PURGE_LIMIT);
  expect(where).not.toHaveBeenCalledWith('createdAt', '<', expect.anything());
});

test('counts use aggregation queries for the requested users and do not list fitTests', async () => {
  getDoc.mockResolvedValue(userDoc('admin'));
  getCountFromServer
    .mockResolvedValueOnce({ data: () => ({ count: 2 }) })
    .mockResolvedValueOnce({ data: () => ({ count: 2 }) })
    .mockResolvedValueOnce({ data: () => ({ count: 0 }) });

  await expect(countFitTestsForUser('tester-1')).resolves.toBe(2);
  await expect(getFitTestCountsByUser('admin-1', ['tester-1', 'tester-2', 'tester-1'])).resolves.toEqual({
    'tester-1': 2,
  });

  expect(getDocs).not.toHaveBeenCalled();
  expect(where).toHaveBeenCalledWith('userId', '==', 'tester-1');
  expect(where).toHaveBeenCalledWith('userId', '==', 'tester-2');
});

test('getUserFitTests does not write lookup or verification documents', async () => {
  setDoc.mockClear();
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

  const records = await getUserFitTests('tester-1');

  expect(records.map((record) => record.id)).toEqual(['ft-1']);
  expect(setDoc).not.toHaveBeenCalled();
});
