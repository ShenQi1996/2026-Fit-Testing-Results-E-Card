// Built-in production web config. Used unless APP_ENV is exactly "staging".
// Staging builds must not copy these identifiers into FIREBASE_* values.
const PROD_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDb-yI2sKaNHNUWLVAL6begbfYajW0dXIQ',
  authDomain: 'fit-test-result-e-card-2026.firebaseapp.com',
  projectId: 'fit-test-result-e-card-2026',
  storageBucket: 'fit-test-result-e-card-2026.firebasestorage.app',
  messagingSenderId: '150291492122',
  appId: '1:150291492122:web:1d0c66527cba20ae5210a3',
};

module.exports = {
  PROD_FIREBASE_CONFIG,
};
