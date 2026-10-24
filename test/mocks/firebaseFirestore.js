const noop = () => {};

exports.collection = noop;
exports.addDoc = async () => ({ id: "mock-id" });
exports.getDocs = jest.fn(async () => ({ docs: [], empty: true, forEach() {} }));
exports.doc = jest.fn((...args) => ({ args }));
exports.getDoc = jest.fn(async () => ({ exists: () => false, data: () => null, id: "mock-id" }));
exports.setDoc = jest.fn(async () => {});
exports.updateDoc = jest.fn(async () => {});
exports.deleteDoc = jest.fn(async () => {});
exports.query = jest.fn((...args) => ({ kind: 'query', args }));
exports.where = jest.fn((field, op, value) => ({ kind: 'where', field, op, value }));
exports.orderBy = jest.fn((field, direction) => ({ kind: 'orderBy', field, direction }));
exports.Timestamp = {
  now: () => ({ toDate: () => new Date(0) }),
  fromDate: (date) => ({ toDate: () => date, kind: 'timestamp', date }),
};
exports.deleteField = () => ({ kind: 'deleteField' });
exports.writeBatch = jest.fn(() => ({
  delete: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  commit: jest.fn(async () => {}),
}));
exports.getFirestore = () => ({});
