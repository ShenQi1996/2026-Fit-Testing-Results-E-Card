const noop = () => {};
const asyncNoop = async () => null;

exports.createUserWithEmailAndPassword = jest.fn(asyncNoop);
exports.signInWithEmailAndPassword = jest.fn(asyncNoop);
exports.signOut = jest.fn(asyncNoop);
exports.updateProfile = asyncNoop;
exports.updateEmail = asyncNoop;
exports.updatePassword = asyncNoop;
exports.reauthenticateWithCredential = asyncNoop;
exports.EmailAuthProvider = { credential: noop };
exports.onAuthStateChanged = jest.fn(() => jest.fn());
exports.deleteUser = jest.fn(asyncNoop);
exports.signInWithPopup = jest.fn(asyncNoop);
exports.signInWithRedirect = jest.fn(asyncNoop);
exports.getRedirectResult = jest.fn(asyncNoop);
exports.GoogleAuthProvider = function GoogleAuthProvider() {
  this.addScope = () => {};
  this.setCustomParameters = () => {};
};
const authState = { currentUser: null };
exports.getAuth = () => authState;
