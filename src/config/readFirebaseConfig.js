// Resolves the Firebase web config for a webpack build.
// APP_ENV unset (production Vercel) keeps the baked-in production project.
// APP_ENV=staging must supply every FIREBASE_* value and must not target production.

import { PROD_FIREBASE_CONFIG } from './prodFirebaseConfig';
import { FIREBASE_ENV_KEYS, assertStagingFirebaseEnv } from './stagingFirebaseGuard';

export { PROD_FIREBASE_CONFIG, FIREBASE_ENV_KEYS };

export const PROD_PROJECT_ID = PROD_FIREBASE_CONFIG.projectId;

/**
 * @param {string|undefined} appEnv
 * @param {Record<string, string|undefined>} env
 * @returns {typeof PROD_FIREBASE_CONFIG}
 */
export const resolveFirebaseConfig = (appEnv, env = {}) => {
  if (appEnv !== 'staging') {
    return PROD_FIREBASE_CONFIG;
  }
  return assertStagingFirebaseEnv(env);
};
