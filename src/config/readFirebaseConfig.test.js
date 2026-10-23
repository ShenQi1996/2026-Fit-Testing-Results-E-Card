import fs from 'fs';
import { PROD_FIREBASE_CONFIG } from './prodFirebaseConfig';
import { FIREBASE_ENV_KEYS, readFirebaseConfig } from './readFirebaseConfig';
import { resolveFirebaseConfig } from './resolveFirebaseConfig';

const completeEnv = {
  FIREBASE_API_KEY: 'staging-api-key',
  FIREBASE_AUTH_DOMAIN: 'fit-test-result-e-card-staging.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'fit-test-result-e-card-staging',
  FIREBASE_STORAGE_BUCKET: 'fit-test-result-e-card-staging.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: '123456789012',
  FIREBASE_APP_ID: '1:123456789012:web:staging',
};

test('readFirebaseConfig returns the env values and nothing else', () => {
  expect(readFirebaseConfig(completeEnv)).toEqual({
    apiKey: 'staging-api-key',
    authDomain: 'fit-test-result-e-card-staging.firebaseapp.com',
    projectId: 'fit-test-result-e-card-staging',
    storageBucket: 'fit-test-result-e-card-staging.firebasestorage.app',
    messagingSenderId: '123456789012',
    appId: '1:123456789012:web:staging',
  });
});

test('readFirebaseConfig fails when any value is missing or blank', () => {
  expect(() => readFirebaseConfig({})).toThrow(/FIREBASE_API_KEY/);
  expect(() => readFirebaseConfig({
    ...completeEnv,
    FIREBASE_PROJECT_ID: '   ',
  })).toThrow(/FIREBASE_PROJECT_ID/);
  expect(() => readFirebaseConfig({
    ...completeEnv,
    FIREBASE_APP_ID: '',
  })).toThrow(/does not use the production config/i);
});

test('an unset APP_ENV keeps the production config even if staging vars are present', () => {
  expect(resolveFirebaseConfig({})).toEqual(PROD_FIREBASE_CONFIG);
  expect(resolveFirebaseConfig({
    ...completeEnv,
    APP_ENV: '   ',
  }).projectId).toBe('fit-test-result-e-card-2026');
});

test('APP_ENV=staging requires every Firebase variable and ignores the production config', () => {
  expect(resolveFirebaseConfig({
    ...completeEnv,
    APP_ENV: 'staging',
  }).projectId).toBe('fit-test-result-e-card-staging');
  expect(() => resolveFirebaseConfig({ APP_ENV: 'staging' })).toThrow(/FIREBASE_API_KEY/);
  expect(() => resolveFirebaseConfig({ APP_ENV: 'preview' })).toThrow(/not supported/);
});

test('the client reads APP_ENV and the Firebase env names', () => {
  const source = fs.readFileSync('src/config/firebase.js', 'utf8');
  expect(source).toContain('APP_ENV');
  FIREBASE_ENV_KEYS.forEach((key) => {
    expect(source).toContain(key);
  });
});

test('webpack wires APP_ENV with DefinePlugin and EnvironmentPlugin', () => {
  const webpackSource = fs.readFileSync('webpack.config.js', 'utf8');
  expect(webpackSource).toContain('EnvironmentPlugin');
  expect(webpackSource).toContain('DefinePlugin');
  expect(webpackSource).toContain('APP_ENV');
  FIREBASE_ENV_KEYS.forEach((key) => {
    expect(webpackSource).toContain(key);
  });
});
