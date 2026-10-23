/* global process, require */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { readFirebaseConfig } from './readFirebaseConfig';

const firebaseEnv = {
  APP_ENV: process.env.APP_ENV,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
};

// Branch on the inlined APP_ENV so a staging build does not include the
// production config module.
export const firebaseConfig = process.env.APP_ENV === 'staging'
  ? readFirebaseConfig(firebaseEnv)
  : require('./prodFirebaseConfig').PROD_FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
