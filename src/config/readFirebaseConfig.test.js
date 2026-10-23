import fs from 'fs';
import {
  FIREBASE_ENV_KEYS,
  PROD_FIREBASE_CONFIG,
  PROD_PROJECT_ID,
  resolveFirebaseConfig,
} from './readFirebaseConfig';

const stagingEnv = {
  FIREBASE_API_KEY: 'staging-api-key',
  FIREBASE_AUTH_DOMAIN: 'fit-test-result-e-card-staging.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'fit-test-result-e-card-staging',
  FIREBASE_STORAGE_BUCKET: 'fit-test-result-e-card-staging.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: '966738964858',
  FIREBASE_APP_ID: '1:966738964858:web:9a5324a2db3326169666c3',
};

test('an unset APP_ENV keeps the production Firebase config', () => {
  expect(resolveFirebaseConfig(undefined, {})).toEqual(PROD_FIREBASE_CONFIG);
  expect(resolveFirebaseConfig('', stagingEnv)).toEqual(PROD_FIREBASE_CONFIG);
  expect(PROD_FIREBASE_CONFIG.projectId).toBe(PROD_PROJECT_ID);
  expect(PROD_FIREBASE_CONFIG.apiKey).toBe('AIzaSyDb-yI2sKaNHNUWLVAL6begbfYajW0dXIQ');
});

test('APP_ENV=staging requires every Firebase value and rejects production', () => {
  expect(resolveFirebaseConfig('staging', stagingEnv)).toEqual({
    apiKey: 'staging-api-key',
    authDomain: 'fit-test-result-e-card-staging.firebaseapp.com',
    projectId: 'fit-test-result-e-card-staging',
    storageBucket: 'fit-test-result-e-card-staging.firebasestorage.app',
    messagingSenderId: '966738964858',
    appId: '1:966738964858:web:9a5324a2db3326169666c3',
  });

  expect(() => resolveFirebaseConfig('staging', {})).toThrow(/FIREBASE_API_KEY/);
  expect(() => resolveFirebaseConfig('staging', {
    ...stagingEnv,
    FIREBASE_APP_ID: '   ',
  })).toThrow(/FIREBASE_APP_ID/);
  expect(() => resolveFirebaseConfig('staging', {
    ...stagingEnv,
    FIREBASE_PROJECT_ID: PROD_PROJECT_ID,
  })).toThrow(/cannot use production project fit-test-result-e-card-2026/);
});

test('the client reads APP_ENV and FIREBASE_* and still contains the production fallback', () => {
  const source = fs.readFileSync('src/config/firebase.js', 'utf8');
  expect(source).toContain('process.env.APP_ENV');
  FIREBASE_ENV_KEYS.forEach((key) => {
    expect(source).toContain(`process.env.${key}`);
  });
  expect(source).toContain('resolveFirebaseConfig');

  const webpackSource = fs.readFileSync('webpack.config.js', 'utf8');
  expect(webpackSource).toContain('EnvironmentPlugin');
  expect(webpackSource).toContain('APP_ENV');
  FIREBASE_ENV_KEYS.forEach((key) => {
    expect(webpackSource).toContain(key);
  });
});
