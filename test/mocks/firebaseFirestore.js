const noop = () => {};

exports.collection = jest.fn((_db, name) => ({ kind: 'collection', path: name }));
exports.addDoc = jest.fn(async () => ({ id: "mock-id" }));
exports.getDocs = jest.fn(async () => ({ docs: [], empty: true, forEach() {} }));
exports.doc = jest.fn((...args) => ({
  args,
  id: typeof args[args.length - 1] === 'string' ? args[args.length - 1] : 'mock-id',
}));
exports.getDoc = jest.fn(async () => ({ exists: () => false, data: () => null, id: "mock-id" }));
exports.setDoc = jest.fn(async () => {});
exports.updateDoc = jest.fn(async () => {});
exports.deleteDoc = jest.fn(async () => {});
exports.query = jest.fn((...args) => ({ kind: 'query', args }));
exports.where = jest.fn((field, op, value) => ({ kind: 'where', field, op, value }));
exports.orderBy = jest.fn((field, direction) => ({ kind: 'orderBy', field, direction }));
exports.limit = jest.fn((count) => ({ kind: 'limit', count }));
exports.startAfter = jest.fn((docSnap) => ({ kind: 'startAfter', docSnap }));
exports.getCountFromServer = jest.fn(async () => ({ data: () => ({ count: 0 }) }));
exports.Timestamp = {
  now: () => ({ toDate: () => new Date(0) }),
  fromDate: (date) => ({ toDate: () => date, kind: 'timestamp', date }),
};
exports.deleteField = () => ({ kind: 'deleteField' });
exports.arrayRemove = (...values) => ({ kind: 'arrayRemove', values });
exports.arrayUnion = (...values) => ({ kind: 'arrayUnion', values });
exports.serverTimestamp = () => ({ kind: 'serverTimestamp' });
exports.writeBatch = jest.fn(() => ({
  delete: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  commit: jest.fn(async () => {}),
}));
exports.getFirestore = () => ({});
