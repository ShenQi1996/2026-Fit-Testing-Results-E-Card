import { getFacultyFitTests, getUserFitTestsPage } from './firebaseDb';
import { notifyFitTestActivity } from '../utils/fitTestActivity';
import {
  clearFitTestListStore,
  getFitTestListSnapshot,
  loadFitTestList,
  loadMoreFitTests,
  subscribeFitTestList,
  TESTER_RESULTS_FILL_MAX_BATCHES,
  TESTER_RESULTS_PAGE_SIZE,
  visibleFitTestCountForUser,
  withSignatures,
} from './fitTestListStore';

jest.mock('./firebaseDb', () => ({
  TESTER_RESULTS_PAGE_SIZE: 25,
  getUserFitTestsPage: jest.fn(),
  getFacultyFitTests: jest.fn(),
}));

const tester = { uid: 'tester-1', role: 'tester' };
const faculty = {
  uid: 'faculty-1',
  role: 'faculty',
  school: 'Helene College of Nursing',
};

const record = (id, extra = {}) => ({
  id,
  clientName: id,
  issueDate: '10/24/2026',
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  clearFitTestListStore();
  getUserFitTestsPage.mockResolvedValue({
    records: [record('ft-1', { signatureDataUrl: 'data:sig' })],
    hasMore: false,
    cursor: { id: 'ft-1' },
  });
  getFacultyFitTests.mockResolvedValue([record('ft-2')]);
});

test('sidebar and results share one tester fetch and keep signatures out of the list', async () => {
  const [first, second] = await Promise.all([
    loadFitTestList(tester),
    loadFitTestList(tester),
  ]);

  expect(getUserFitTestsPage).toHaveBeenCalledTimes(1);
  expect(getUserFitTestsPage).toHaveBeenCalledWith('tester-1', {
    now: undefined,
    limit: TESTER_RESULTS_PAGE_SIZE,
    cursor: undefined,
  });
  expect(first).toBe(second);
  expect(getFitTestListSnapshot().records).toEqual([
    expect.objectContaining({ id: 'ft-1', hasSignatureData: true }),
  ]);
  expect(getFitTestListSnapshot().records[0].signatureDataUrl).toBeUndefined();
  expect(withSignatures(getFitTestListSnapshot().records[0]).signatureDataUrl).toBe('data:sig');
  expect(getFitTestListSnapshot().count).toBe(1);

  await loadFitTestList(tester);
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(1);
});

test('a later page is loaded only when requested', async () => {
  const firstPage = Array.from({ length: TESTER_RESULTS_PAGE_SIZE }, (_, i) => record(`ft-${i + 1}`));
  getUserFitTestsPage
    .mockResolvedValueOnce({
      records: firstPage,
      hasMore: true,
      cursor: { id: 'cursor-1' },
    })
    .mockResolvedValueOnce({
      records: [record('ft-26')],
      hasMore: false,
      cursor: { id: 'cursor-2' },
    });

  await loadFitTestList(tester);
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(1);
  expect(getFitTestListSnapshot().hasMore).toBe(true);
  expect(getFitTestListSnapshot().count).toBe(TESTER_RESULTS_PAGE_SIZE);

  await loadMoreFitTests(tester);
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(2);
  expect(getUserFitTestsPage.mock.calls[1][1]).toEqual({
    now: undefined,
    limit: TESTER_RESULTS_PAGE_SIZE,
    cursor: { id: 'cursor-1' },
  });
  expect(getFitTestListSnapshot().records.map((item) => item.id)).toEqual([
    ...firstPage.map((item) => item.id),
    'ft-26',
  ]);
  expect(getFitTestListSnapshot().count).toBe(26);
  expect(getFitTestListSnapshot().hasMore).toBe(false);
});

test('initial load keeps fetching until 25 visible records and holds leftover for load more', async () => {
  const firstVisible = Array.from({ length: 19 }, (_, i) => record(`live-${i + 1}`));
  const secondVisible = Array.from({ length: 10 }, (_, i) => record(`live-${i + 20}`));
  const thirdVisible = Array.from({ length: 8 }, (_, i) => record(`live-${i + 30}`));

  getUserFitTestsPage
    .mockResolvedValueOnce({
      records: firstVisible,
      hasMore: true,
      cursor: { id: 'cursor-1' },
    })
    .mockResolvedValueOnce({
      records: secondVisible,
      hasMore: true,
      cursor: { id: 'cursor-2' },
    })
    .mockResolvedValueOnce({
      records: thirdVisible,
      hasMore: false,
      cursor: { id: 'cursor-3' },
    });

  await loadFitTestList(tester);
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(2);
  expect(getUserFitTestsPage.mock.calls[1][1].cursor).toEqual({ id: 'cursor-1' });
  expect(getFitTestListSnapshot().records.map((item) => item.id)).toEqual(
    Array.from({ length: 25 }, (_, i) => `live-${i + 1}`)
  );
  expect(getFitTestListSnapshot().count).toBe(25);
  expect(getFitTestListSnapshot().hasMore).toBe(true);
  expect(visibleFitTestCountForUser('tester-1')).toBeNull();

  await loadMoreFitTests(tester);
  // Leftover 4 from the second batch plus the third batch fill the rest; no refetch of batch 2.
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(3);
  expect(getUserFitTestsPage.mock.calls[2][1].cursor).toEqual({ id: 'cursor-2' });
  const ids = getFitTestListSnapshot().records.map((item) => item.id);
  expect(ids).toEqual(Array.from({ length: 37 }, (_, i) => `live-${i + 1}`));
  expect(new Set(ids).size).toBe(ids.length);
  expect(getFitTestListSnapshot().count).toBe(37);
  expect(getFitTestListSnapshot().hasMore).toBe(false);
  expect(visibleFitTestCountForUser('tester-1')).toBe(37);
});

test('fill stops after the max-batch guard and still offers load more', async () => {
  getUserFitTestsPage.mockImplementation(async (_userId, options = {}) => {
    const start = options.cursor?.n || 0;
    return {
      records: [],
      hasMore: start < 20,
      cursor: { id: `cursor-${start + 1}`, n: start + 1 },
    };
  });

  await loadFitTestList(tester);
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(TESTER_RESULTS_FILL_MAX_BATCHES);
  expect(getFitTestListSnapshot().records).toEqual([]);
  expect(getFitTestListSnapshot().hasMore).toBe(true);

  await loadMoreFitTests(tester);
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(TESTER_RESULTS_FILL_MAX_BATCHES * 2);
});

test('duplicate ids across batches are skipped', async () => {
  getUserFitTestsPage
    .mockResolvedValueOnce({
      records: [record('ft-1'), record('ft-2')],
      hasMore: true,
      cursor: { id: 'cursor-1' },
    })
    .mockResolvedValueOnce({
      records: [record('ft-2'), record('ft-3')],
      hasMore: false,
      cursor: { id: 'cursor-2' },
    });

  await loadFitTestList(tester);
  expect(getFitTestListSnapshot().records.map((item) => item.id)).toEqual(['ft-1', 'ft-2', 'ft-3']);
  expect(getFitTestListSnapshot().count).toBe(3);
  expect(getFitTestListSnapshot().hasMore).toBe(false);
});

test('faculty reuse one school-limited fetch, and activity invalidates the cache', async () => {
  await loadFitTestList(faculty);
  await loadFitTestList(faculty);
  expect(getFacultyFitTests).toHaveBeenCalledTimes(1);
  expect(getFacultyFitTests).toHaveBeenCalledWith(faculty, {});
  expect(getUserFitTestsPage).not.toHaveBeenCalled();
  expect(getFitTestListSnapshot().count).toBe(1);

  const seen = [];
  const unsubscribe = subscribeFitTestList((snap) => seen.push(snap.count));
  await Promise.resolve();
  notifyFitTestActivity();
  await Promise.resolve();
  await Promise.resolve();
  expect(getFacultyFitTests).toHaveBeenCalledTimes(2);
  unsubscribe();
  expect(getFitTestListSnapshot().loaded).toBe(true);
});

test('faculty outside the access window get an empty cached list and do not read', async () => {
  const closed = {
    ...faculty,
    startDate: '2099-01-01T00:00:00.000Z',
    endDate: '2099-12-31T00:00:00.000Z',
  };
  await loadFitTestList(closed, { now: new Date('2026-11-14T00:00:00.000Z') });
  expect(getFacultyFitTests).not.toHaveBeenCalled();
  expect(getFitTestListSnapshot()).toEqual(expect.objectContaining({
    records: [],
    count: 0,
    loaded: true,
  }));
});
