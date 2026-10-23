import fs from 'fs';
import { FIREBASE_ENV_KEYS, readFirebaseConfig } from './readFirebaseConfig';

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
  })).toThrow(/no built-in project fallback/i);
});

test('the client bundle source has no production Firebase config', () => {
  const source = fs.readFileSync('src/config/firebase.js', 'utf8');
  expect(source).not.toContain('fit-test-result-e-card-2026');
  expect(source).not.toContain('AIza');
  FIREBASE_ENV_KEYS.forEach((key) => {
    expect(source).toContain(key);
  });
});

test('webpack requires the same Firebase env keys', () => {
  const webpackSource = fs.readFileSync('webpack.config.js', 'utf8');
  FIREBASE_ENV_KEYS.forEach((key) => {
    expect(webpackSource).toContain(key);
  });
});
