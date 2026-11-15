import {
  getFacultyFitTests,
  getUserFitTestsPage,
  TESTER_RESULTS_PAGE_SIZE,
} from './firebaseDb';
import { subscribeFitTestActivity } from '../utils/fitTestActivity';
import { isAccessWindowOpen, isFaculty } from '../utils/roles';

export { TESTER_RESULTS_PAGE_SIZE };

const SIGNATURE_FIELDS = ['signatureDataUrl', 'testerSignatureDataUrl'];

const emptySnapshot = () => ({
  key: '',
  records: [],
  hasMore: false,
  cursor: null,
  loading: false,
  loadingMore: false,
  error: '',
  indexError: null,
  count: 0,
  loaded: false,
});

let snapshot = emptySnapshot();
let inflight = null;
let rememberedUser = null;
const signaturesById = new Map();
const listeners = new Set();

const listKeyFor = (user) => {
  if (!user?.uid) return '';
  if (isFaculty(user)) return `faculty:${user.uid}:${user.school || ''}`;
  return `tester:${user.uid}`;
};

const emit = () => {
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('Fit test list listener failed:', error);
    }
  });
};

const setSnapshot = (next) => {
  snapshot = {
    ...snapshot,
    ...next,
    count: Array.isArray(next.records) ? next.records.length : snapshot.records.length,
  };
  if (Array.isArray(next.records)) {
    snapshot.count = next.records.length;
  }
  emit();
};

const splitSignatures = (record) => {
  const rest = { ...record };
  const signatures = {};
  SIGNATURE_FIELDS.forEach((field) => {
    if (rest[field]) {
      signatures[field] = rest[field];
      delete rest[field];
      if (field === 'signatureDataUrl') rest.hasSignatureData = true;
      if (field === 'testerSignatureDataUrl') rest.hasTesterSignatureData = true;
    }
  });
  if (Object.keys(signatures).length > 0) {
    signaturesById.set(record.id, { ...(signaturesById.get(record.id) || {}), ...signatures });
  }
  return rest;
};

const stashRecords = (records, { append = false } = {}) => {
  const mapped = records.map(splitSignatures);
  const nextRecords = append
    ? [...snapshot.records, ...mapped.filter((record) => !snapshot.records.some((item) => item.id === record.id))]
    : mapped;
  return nextRecords;
};

export const getFitTestListSnapshot = () => snapshot;

export const subscribeFitTestList = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const withSignatures = (record) => {
  if (!record?.id) return record;
  const signatures = signaturesById.get(record.id);
  return signatures ? { ...record, ...signatures } : record;
};

export const clearFitTestListStore = () => {
  snapshot = emptySnapshot();
  inflight = null;
  rememberedUser = null;
  signaturesById.clear();
};

const loadErrorState = (error) => {
  if (error?.message === 'FIREBASE_INDEX_REQUIRED') {
    return {
      indexError: {
        url: error.indexUrl,
        originalError: error.originalError,
      },
      error: '',
    };
  }
  return {
    error: 'Failed to load test results. Please try again.',
    indexError: null,
  };
};

const fetchList = async (user, { force = false, more = false, now } = {}) => {
  const key = listKeyFor(user);
  if (!user?.uid || !key) {
    clearFitTestListStore();
    emit();
    return snapshot;
  }

  if (isFaculty(user) && !isAccessWindowOpen(user, now instanceof Date ? now : new Date())) {
    rememberedUser = user;
    signaturesById.clear();
    setSnapshot({
      ...emptySnapshot(),
      key,
      loading: false,
      loaded: true,
    });
    return snapshot;
  }

  rememberedUser = user;

  if (!force && !more && snapshot.key === key && snapshot.loaded && !snapshot.loading) {
    return snapshot;
  }

  // A second caller for the same key shares the in-flight request.
  if (inflight && snapshot.key === key && !force) {
    return inflight;
  }

  if (more && (snapshot.loading || snapshot.loadingMore || !snapshot.hasMore || snapshot.key !== key)) {
    return snapshot;
  }

  const isMore = Boolean(more && snapshot.key === key && snapshot.hasMore);
  const keepRecords = isMore || snapshot.key === key;
  const showLoading = !isMore && !keepRecords;
  setSnapshot({
    key,
    loading: showLoading,
    loadingMore: isMore,
    error: isMore || force ? snapshot.error : '',
    indexError: isMore || force ? snapshot.indexError : null,
    records: keepRecords ? snapshot.records : [],
    loaded: keepRecords ? snapshot.loaded : false,
  });

  const run = (async () => {
    try {
      if (isFaculty(user)) {
        const records = await getFacultyFitTests(user, now instanceof Date ? { now } : {});
        signaturesById.clear();
        setSnapshot({
          key,
          records: stashRecords(records),
          hasMore: false,
          cursor: null,
          loading: false,
          loadingMore: false,
          loaded: true,
          error: '',
          indexError: null,
        });
        return snapshot;
      }

      const page = await getUserFitTestsPage(user.uid, {
        now,
        limit: TESTER_RESULTS_PAGE_SIZE,
        cursor: isMore ? snapshot.cursor : undefined,
      });
      if (!isMore) signaturesById.clear();
      setSnapshot({
        key,
        records: stashRecords(page.records, { append: isMore }),
        hasMore: page.hasMore,
        cursor: page.cursor,
        loading: false,
        loadingMore: false,
        loaded: true,
        error: '',
        indexError: null,
      });
      return snapshot;
    } catch (error) {
      console.error('Error loading fit tests:', error);
      setSnapshot({
        loading: false,
        loadingMore: false,
        loaded: true,
        ...loadErrorState(error),
      });
      return snapshot;
    } finally {
      if (inflight === run) inflight = null;
    }
  })();

  inflight = run;
  return run;
};

export const loadFitTestList = (user, options = {}) => fetchList(user, options);

export const loadMoreFitTests = (user, options = {}) => fetchList(user, { ...options, more: true });

export const patchFitTestListRecord = (id, updates, { replace = false } = {}) => {
  if (!id) return;
  setSnapshot({
    records: snapshot.records.map((record) => (
      record.id === id
        ? splitSignatures(replace ? { id, ...updates } : { ...record, ...updates })
        : record
    )),
  });
};

export const removeFitTestListRecord = (id) => {
  if (!id) return;
  signaturesById.delete(id);
  setSnapshot({
    records: snapshot.records.filter((record) => record.id !== id),
  });
};

subscribeFitTestActivity(() => {
  if (!rememberedUser?.uid) {
    snapshot = emptySnapshot();
    signaturesById.clear();
    emit();
    return;
  }
  fetchList(rememberedUser, { force: true });
});
