import { getFacultyFitTests, getUserFitTestsPage } from './firebaseDb';
import { notifyFitTestActivity } from '../utils/fitTestActivity';
import {
  clearFitTestListStore,
  getFitTestListSnapshot,
  loadFitTestList,
  loadMoreFitTests,
  subscribeFitTestList,
  TESTER_RESULTS_PAGE_SIZE,
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
  getUserFitTestsPage
    .mockResolvedValueOnce({
      records: [record('ft-1')],
      hasMore: true,
      cursor: { id: 'cursor-1' },
    })
    .mockResolvedValueOnce({
      records: [record('ft-2')],
      hasMore: false,
      cursor: { id: 'cursor-2' },
    });

  await loadFitTestList(tester);
  expect(getFitTestListSnapshot().hasMore).toBe(true);
  expect(getFitTestListSnapshot().count).toBe(1);

  await loadMoreFitTests(tester);
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(2);
  expect(getUserFitTestsPage.mock.calls[1][1]).toEqual({
    now: undefined,
    limit: TESTER_RESULTS_PAGE_SIZE,
    cursor: { id: 'cursor-1' },
  });
  expect(getFitTestListSnapshot().records.map((item) => item.id)).toEqual(['ft-1', 'ft-2']);
  expect(getFitTestListSnapshot().count).toBe(2);
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
