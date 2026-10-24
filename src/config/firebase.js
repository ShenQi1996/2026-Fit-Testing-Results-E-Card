/* global process */
// Firebase web app. Production builds (`webpack --mode=production`, APP_ENV unset)
// keep the production project. `--mode=development` and APP_ENV=staging read
// FIREBASE_* inlined by webpack EnvironmentPlugin.
// A development build with missing staging keys fails instead of using production.
// Each process.env.NAME access must be a direct member expression so EnvironmentPlugin
// can replace it. firebaseAuth.js creates its secondary app from this same object.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { resolveFirebaseConfig } from './readFirebaseConfig';

export const firebaseConfig = resolveFirebaseConfig(process.env.APP_ENV, {
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
}, process.env.NODE_ENV);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
