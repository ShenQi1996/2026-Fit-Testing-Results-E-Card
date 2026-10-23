const ENV_KEYS = [
  'APP_ENV',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

const snapshotEnv = () => {
  const saved = {};
  ENV_KEYS.forEach((key) => {
    saved[key] = process.env[key];
  });
  return saved;
};

const restoreEnv = (saved) => {
  ENV_KEYS.forEach((key) => {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  });
};

const stagingEnv = {
  APP_ENV: 'staging',
  FIREBASE_API_KEY: 'staging-api-key',
  FIREBASE_AUTH_DOMAIN: 'fit-test-result-e-card-staging.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'fit-test-result-e-card-staging',
  FIREBASE_STORAGE_BUCKET: 'fit-test-result-e-card-staging.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: '966738964858',
  FIREBASE_APP_ID: '1:966738964858:web:9a5324a2db3326169666c3',
};

const loadWebpack = () => {
  jest.resetModules();
  return require('../../webpack.config.js');
};

afterEach(() => {
  jest.resetModules();
});

test('webpack fails a staging build when a Firebase value is missing', () => {
  const saved = snapshotEnv();
  try {
    Object.entries(stagingEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    delete process.env.FIREBASE_STORAGE_BUCKET;
    expect(loadWebpack).toThrow(/FIREBASE_STORAGE_BUCKET/);
  } finally {
    restoreEnv(saved);
  }
});

test('webpack fails a staging build pointed at the production project', () => {
  const saved = snapshotEnv();
  try {
    Object.entries(stagingEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    process.env.FIREBASE_PROJECT_ID = 'fit-test-result-e-card-2026';
    expect(loadWebpack).toThrow(/cannot use production project fit-test-result-e-card-2026/);
  } finally {
    restoreEnv(saved);
  }
});

test('webpack allows a build with APP_ENV unset', () => {
  const saved = snapshotEnv();
  try {
    ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
    expect(loadWebpack).not.toThrow();
  } finally {
    restoreEnv(saved);
  }
});
