// Shared by webpack.config.js and the client. Staging must not receive any
// production Firebase identifier, including a different casing or a value that
// only embeds the production project id.

const { PROD_FIREBASE_CONFIG } = require('./prodFirebaseConfig');

const FIREBASE_ENV_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

const PROD_PROJECT_MARKER = 'fit-test-result-e-card-2026';

const trim = (value) => String(value ?? '').trim();
const lower = (value) => trim(value).toLowerCase();

const PROD_IDENTIFIER_KEYS = [
  ['FIREBASE_API_KEY', PROD_FIREBASE_CONFIG.apiKey, 'apiKey'],
  ['FIREBASE_APP_ID', PROD_FIREBASE_CONFIG.appId, 'appId'],
  ['FIREBASE_MESSAGING_SENDER_ID', PROD_FIREBASE_CONFIG.messagingSenderId, 'messagingSenderId'],
];

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}}
 */
const assertStagingFirebaseEnv = (env = {}) => {
  const missing = FIREBASE_ENV_KEYS.filter((key) => !trim(env[key]));
  if (missing.length > 0) {
    throw new Error(
      `APP_ENV=staging requires ${missing.join(', ')}. `
      + 'Refusing to use the production Firebase project.'
    );
  }

  FIREBASE_ENV_KEYS.forEach((key) => {
    if (lower(env[key]).includes(PROD_PROJECT_MARKER)) {
      throw new Error(
        `APP_ENV=staging cannot use ${key} that contains production project ${PROD_PROJECT_MARKER}.`
      );
    }
  });

  PROD_IDENTIFIER_KEYS.forEach(([key, prodValue, label]) => {
    if (lower(env[key]) === lower(prodValue)) {
      throw new Error(`APP_ENV=staging cannot use the production Firebase ${label}.`);
    }
  });

  return {
    apiKey: trim(env.FIREBASE_API_KEY),
    authDomain: trim(env.FIREBASE_AUTH_DOMAIN),
    projectId: trim(env.FIREBASE_PROJECT_ID),
    storageBucket: trim(env.FIREBASE_STORAGE_BUCKET),
    messagingSenderId: trim(env.FIREBASE_MESSAGING_SENDER_ID),
    appId: trim(env.FIREBASE_APP_ID),
  };
};

module.exports = {
  FIREBASE_ENV_KEYS,
  PROD_PROJECT_MARKER,
  assertStagingFirebaseEnv,
};
