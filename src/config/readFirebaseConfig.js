// Resolves the Firebase web config for a webpack build.
// Production builds (`webpack --mode=production`, APP_ENV unset) keep the
// baked-in production project. That is how production Vercel builds.
// webpack does not set NODE_ENV before loading webpack.config.js, so the
// dev-server guard reads argv.mode. The bundle still receives NODE_ENV from
// that mode. APP_ENV=staging, and mode development, must supply every
// FIREBASE_* value and must not target production.

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
