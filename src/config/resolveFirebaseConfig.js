/* global require */
import { readFirebaseConfig } from './readFirebaseConfig';

export const resolveFirebaseConfig = (env = {}) => {
  const appEnv = String(env.APP_ENV || '').trim();
  if (appEnv === 'staging') {
    return readFirebaseConfig(env);
  }
  if (!appEnv) {
    return { ...require('./prodFirebaseConfig').PROD_FIREBASE_CONFIG };
  }
  throw new Error(
    `APP_ENV=${appEnv} is not supported. Leave APP_ENV unset for the built-in production Firebase config, or set APP_ENV=staging with every FIREBASE_* variable.`
  );
};
