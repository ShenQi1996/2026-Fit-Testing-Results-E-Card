afterEach(() => {
  try {
    const db = require('../src/services/firebaseDb');
    if (typeof db.clearUserProfileCache === 'function') {
      db.clearUserProfileCache();
    }
  } catch (_error) {
    // The module is mocked or not loaded in this test file.
  }
  try {
    const store = require('../src/services/fitTestListStore');
    if (typeof store.clearFitTestListStore === 'function') {
      store.clearFitTestListStore();
    }
  } catch (_error) {
    // The module is mocked or not loaded in this test file.
  }
});
