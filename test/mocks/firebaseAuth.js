const noop = () => {};
const asyncNoop = async () => null;

exports.createUserWithEmailAndPassword = asyncNoop;
exports.signInWithEmailAndPassword = asyncNoop;
exports.signOut = asyncNoop;
exports.updateProfile = asyncNoop;
exports.updateEmail = asyncNoop;
exports.updatePassword = asyncNoop;
exports.reauthenticateWithCredential = asyncNoop;
exports.EmailAuthProvider = { credential: noop };
exports.onAuthStateChanged = () => noop;
exports.signInWithPopup = asyncNoop;
exports.signInWithRedirect = asyncNoop;
exports.getRedirectResult = asyncNoop;
exports.GoogleAuthProvider = function GoogleAuthProvider() {};
exports.getAuth = () => ({});
