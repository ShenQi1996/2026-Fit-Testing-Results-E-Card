// Names must stay in sync with FIREBASE_ENV_KEYS in webpack.config.js.
export const FIREBASE_ENV_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

export const readFirebaseConfig = (env = {}) => {
  const missing = FIREBASE_ENV_KEYS.filter((key) => !String(env[key] || '').trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase config: ${missing.join(', ')}. `
      + 'Set them for this build in .env.local or in Vercel (Production and Preview). '
      + 'There is no built-in project fallback.'
    );
  }

  return {
    apiKey: String(env.FIREBASE_API_KEY).trim(),
    authDomain: String(env.FIREBASE_AUTH_DOMAIN).trim(),
    projectId: String(env.FIREBASE_PROJECT_ID).trim(),
    storageBucket: String(env.FIREBASE_STORAGE_BUCKET).trim(),
    messagingSenderId: String(env.FIREBASE_MESSAGING_SENDER_ID).trim(),
    appId: String(env.FIREBASE_APP_ID).trim(),
  };
};
