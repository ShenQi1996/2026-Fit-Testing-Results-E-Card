// Resolves the Firebase web config for a webpack build.
// APP_ENV unset (production Vercel) keeps the baked-in production project.
// APP_ENV=staging must supply every FIREBASE_* value and must not target production.

export const PROD_PROJECT_ID = 'fit-test-result-e-card-2026';

export const FIREBASE_ENV_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

// Current production web app. Do not replace this when APP_ENV is unset.
export const PROD_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDb-yI2sKaNHNUWLVAL6begbfYajW0dXIQ',
  authDomain: 'fit-test-result-e-card-2026.firebaseapp.com',
  projectId: 'fit-test-result-e-card-2026',
  storageBucket: 'fit-test-result-e-card-2026.firebasestorage.app',
  messagingSenderId: '150291492122',
  appId: '1:150291492122:web:1d0c66527cba20ae5210a3',
};

const trimmed = (value) => String(value ?? '').trim();

/**
 * @param {string|undefined} appEnv
 * @param {Record<string, string|undefined>} env
 * @returns {typeof PROD_FIREBASE_CONFIG}
 */
export const resolveFirebaseConfig = (appEnv, env = {}) => {
  if (appEnv !== 'staging') {
    return PROD_FIREBASE_CONFIG;
  }

  const missing = FIREBASE_ENV_KEYS.filter((key) => !trimmed(env[key]));
  if (missing.length > 0) {
    throw new Error(
      `APP_ENV=staging requires ${missing.join(', ')}. `
      + 'Refusing to use the production Firebase project.'
    );
  }

  const projectId = trimmed(env.FIREBASE_PROJECT_ID);
  if (projectId === PROD_PROJECT_ID) {
    throw new Error(
      `APP_ENV=staging cannot use production project ${PROD_PROJECT_ID}.`
    );
  }

  return {
    apiKey: trimmed(env.FIREBASE_API_KEY),
    authDomain: trimmed(env.FIREBASE_AUTH_DOMAIN),
    projectId,
    storageBucket: trimmed(env.FIREBASE_STORAGE_BUCKET),
    messagingSenderId: trimmed(env.FIREBASE_MESSAGING_SENDER_ID),
    appId: trimmed(env.FIREBASE_APP_ID),
  };
};
