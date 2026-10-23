// Non-production placeholders so unit tests can import the Firebase client.
// They are not a project fallback for the built app.
const placeholders = {
  FIREBASE_API_KEY: 'test-api-key',
  FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'test-project-not-production',
  FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  FIREBASE_APP_ID: '1:000000000000:web:test',
};

Object.entries(placeholders).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});
