const { PROD_FIREBASE_CONFIG } = require('../../src/config/prodFirebaseConfig');

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

const runWebpack = (argv = { mode: 'production' }) => loadWebpack()({}, argv);

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
    expect(() => runWebpack()).toThrow(/FIREBASE_STORAGE_BUCKET/);
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
    expect(() => runWebpack()).toThrow(/contains production project fit-test-result-e-card-2026/);
  } finally {
    restoreEnv(saved);
  }
});

test('webpack rejects production Firebase identifiers after trim and case folding', () => {
  const saved = snapshotEnv();
  const applyStaging = () => {
    Object.entries(stagingEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  };
  try {
    applyStaging();
    process.env.FIREBASE_PROJECT_ID = '  FIT-TEST-RESULT-E-CARD-2026  ';
    expect(() => runWebpack()).toThrow(/contains production project fit-test-result-e-card-2026/);

    applyStaging();
    process.env.FIREBASE_PROJECT_ID = 'not-the-real-project';
    process.env.FIREBASE_API_KEY = PROD_FIREBASE_CONFIG.apiKey;
    expect(() => runWebpack()).toThrow(/production Firebase apiKey/);

    applyStaging();
    process.env.FIREBASE_PROJECT_ID = 'not-the-real-project';
    process.env.FIREBASE_APP_ID = ` ${PROD_FIREBASE_CONFIG.appId.toUpperCase()} `;
    expect(() => runWebpack()).toThrow(/production Firebase appId/);

    applyStaging();
    process.env.FIREBASE_PROJECT_ID = 'not-the-real-project';
    process.env.FIREBASE_MESSAGING_SENDER_ID = PROD_FIREBASE_CONFIG.messagingSenderId;
    expect(() => runWebpack()).toThrow(/production Firebase messagingSenderId/);

    applyStaging();
    process.env.FIREBASE_PROJECT_ID = 'not-the-real-project';
    process.env.FIREBASE_API_KEY = PROD_FIREBASE_CONFIG.apiKey;
    process.env.FIREBASE_AUTH_DOMAIN = PROD_FIREBASE_CONFIG.authDomain;
    process.env.FIREBASE_STORAGE_BUCKET = PROD_FIREBASE_CONFIG.storageBucket;
    process.env.FIREBASE_APP_ID = PROD_FIREBASE_CONFIG.appId;
    expect(() => runWebpack()).toThrow(/contains production project fit-test-result-e-card-2026/);
  } finally {
    restoreEnv(saved);
  }
});

test('webpack development mode fails closed when NODE_ENV is unset', () => {
  const saved = snapshotEnv();
  const savedNodeEnv = process.env.NODE_ENV;
  try {
    ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
    delete process.env.NODE_ENV;
    expect(() => runWebpack({ mode: 'development' })).toThrow(/FIREBASE_API_KEY/);
    expect(() => runWebpack({ mode: 'development' })).toThrow(/production Firebase project/);
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    restoreEnv(saved);
  }
});

test('webpack development mode fails closed even when NODE_ENV is production', () => {
  const saved = snapshotEnv();
  const savedNodeEnv = process.env.NODE_ENV;
  try {
    ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
    process.env.NODE_ENV = 'production';
    expect(() => runWebpack({ mode: 'development' })).toThrow(/FIREBASE_API_KEY/);
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    restoreEnv(saved);
  }
});

test('webpack development mode loads when staging keys are present and APP_ENV is unset', () => {
  const saved = snapshotEnv();
  const savedNodeEnv = process.env.NODE_ENV;
  try {
    Object.entries(stagingEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    delete process.env.APP_ENV;
    delete process.env.NODE_ENV;
    expect(() => runWebpack({ mode: 'development' })).not.toThrow();
    expect(runWebpack({ mode: 'development' }).mode).toBe('development');
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    restoreEnv(saved);
  }
});

test('webpack development mode rejects an APP_ENV other than staging', () => {
  const saved = snapshotEnv();
  try {
    Object.entries(stagingEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    process.env.APP_ENV = 'Staging';
    expect(() => runWebpack({ mode: 'development' })).toThrow(/not "staging"/);
  } finally {
    restoreEnv(saved);
  }
});

test('loading the webpack config does not read NODE_ENV before webpack passes mode', () => {
  const saved = snapshotEnv();
  const savedNodeEnv = process.env.NODE_ENV;
  try {
    ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
    delete process.env.NODE_ENV;
    expect(loadWebpack).not.toThrow();
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    restoreEnv(saved);
  }
});

test('webpack allows a production build with APP_ENV unset', () => {
  const saved = snapshotEnv();
  const savedNodeEnv = process.env.NODE_ENV;
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
    delete process.env.NODE_ENV;
    expect(() => runWebpack({ mode: 'production' })).not.toThrow();
    expect(runWebpack({ mode: 'production' }).mode).toBe('production');
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    restoreEnv(saved);
  }
});

test('webpack allows a build with APP_ENV unset when mode is omitted', () => {
  const saved = snapshotEnv();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
    expect(() => runWebpack({})).not.toThrow();
    expect(runWebpack({}).mode).toBe('production');
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
    restoreEnv(saved);
  }
});

test('webpack warns when APP_ENV is set but is not exactly staging', () => {
  const saved = snapshotEnv();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
    process.env.APP_ENV = 'Staging';
    expect(() => runWebpack({ mode: 'production' })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/not exactly "staging"/));
  } finally {
    warn.mockRestore();
    restoreEnv(saved);
  }
});
