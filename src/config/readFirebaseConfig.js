// Resolves the Firebase web config for a webpack build.
// Production builds (NODE_ENV=production, APP_ENV unset) keep the baked-in
// production project. That is how production Vercel builds.
// APP_ENV=staging, and every NODE_ENV=development build, must supply every
// FIREBASE_* value and must not target production. A dev build never falls
// back to the production project.

import { PROD_FIREBASE_CONFIG } from './prodFirebaseConfig';
import { FIREBASE_ENV_KEYS, assertStagingFirebaseEnv } from './stagingFirebaseGuard';

export { PROD_FIREBASE_CONFIG, FIREBASE_ENV_KEYS };

export const PROD_PROJECT_ID = PROD_FIREBASE_CONFIG.projectId;

/**
 * @param {string|undefined} appEnv
 * @param {Record<string, string|undefined>} env
 * @param {string} [nodeEnv] webpack mode. Development never uses production.
 * @returns {typeof PROD_FIREBASE_CONFIG}
 */
export const resolveFirebaseConfig = (appEnv, env = {}, nodeEnv = 'production') => {
  if (appEnv === 'staging' || nodeEnv === 'development') {
    return assertStagingFirebaseEnv(env);
  }
  return PROD_FIREBASE_CONFIG;
};
