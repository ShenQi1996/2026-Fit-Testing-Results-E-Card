const noop = () => {};

exports.collection = noop;
exports.addDoc = async () => ({ id: "mock-id" });
exports.getDocs = jest.fn(async () => ({ docs: [], empty: true, forEach() {} }));
exports.doc = jest.fn((...args) => ({ args }));
exports.getDoc = jest.fn(async () => ({ exists: () => false, data: () => null, id: "mock-id" }));
exports.setDoc = jest.fn(async () => {});
exports.updateDoc = jest.fn(async () => {});
exports.deleteDoc = jest.fn(async () => {});
exports.query = noop;
exports.where = noop;
exports.orderBy = noop;
exports.Timestamp = { now: () => ({ toDate: () => new Date(0) }) };
exports.writeBatch = () => ({
  delete: noop,
  update: noop,
  set: noop,
  commit: async () => {},
});
exports.getFirestore = () => ({});
