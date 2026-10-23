// Seeds the staging Firebase project with fake Auth users and Firestore docs.
// Refuses to run when the project id is production.
//
//   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/staging-service-account.json npm run seed:staging
//
// Spark plan: run this on your machine. Do not commit the service account file.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Live production project. The seed refuses this id so it cannot write production data.
const PROD_PROJECT_ID = 'fit-test-result-e-card-2026';
const DEFAULT_PASSWORD = 'Staging-only-1';
const FIT_TEST_ID = 'staging-fake-fit-test';
const VERIFICATION_TOKEN = 'c0ffee00c0ffee00c0ffee00c0ffee00';

const ACCOUNTS = [
  {
    key: 'superadmin',
    email: 'staging-superadmin@example.com',
    name: 'Staging Super Admin',
    role: 'superadmin',
    status: 'approved',
  },
  {
    key: 'admin',
    email: 'staging-admin@example.com',
    name: 'Staging Admin',
    role: 'admin',
    status: 'approved',
  },
  {
    key: 'tester',
    email: 'staging-tester@example.com',
    name: 'Staging Tester',
    role: 'tester',
    status: 'approved',
  },
  {
    key: 'pending',
    email: 'staging-pending@example.com',
    name: 'Staging Pending',
    role: 'tester',
    status: 'pending',
  },
];

const assertStagingProject = (projectId) => {
  const id = String(projectId || '').trim();
  if (!id) {
    throw new Error('Firebase project id is missing.');
  }
  if (id === PROD_PROJECT_ID) {
    throw new Error(
      `Refusing to seed production project ${PROD_PROJECT_ID}. `
      + 'Point FIREBASE_SERVICE_ACCOUNT_PATH at the staging service account.'
    );
  }
  return id;
};

const readServiceAccount = (filePath) => {
  if (!filePath || !String(filePath).trim()) {
    throw new Error(
      'Set FIREBASE_SERVICE_ACCOUNT_PATH to the staging service account JSON file. Do not commit that file.'
    );
  }
  const resolved = path.resolve(String(filePath).trim());
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read the service account JSON at ${resolved}.`);
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON is missing client_email or private_key.');
  }
  assertStagingProject(parsed.project_id);
  return parsed;
};

const lookupKeyFor = (clientName, dob, recipientEmail) => {
  const name = clientName.trim().replace(/\s+/g, ' ').toLowerCase();
  const birthDate = dob.trim();
  const email = recipientEmail.trim().toLowerCase();
  return crypto.createHash('sha256').update(`${name}|${birthDate}|${email}`).digest('hex');
};

const buildStagingSeed = (uids, now = new Date('2026-01-15T15:00:00.000Z')) => {
  const required = ['superadmin', 'admin', 'tester', 'pending'];
  required.forEach((key) => {
    if (!uids || !uids[key]) {
      throw new Error(`Missing uid for ${key}.`);
    }
  });

  const iso = now.toISOString();
  const users = ACCOUNTS.map((account) => {
    const data = {
      email: account.email,
      name: account.name,
      role: account.role,
      status: account.status,
      provider: 'password',
      requestedAt: iso,
      createdAt: iso,
      updatedAt: iso,
    };
    if (account.status === 'approved') {
      data.approvedAt = iso;
      data.approvedBy = uids.superadmin;
    }
    return { id: uids[account.key], data };
  });

  const fitTest = {
    userId: uids.tester,
    fitTester: 'Staging Tester',
    clientName: 'Fake Client',
    dob: '01/15/1990',
    recipientEmail: 'fake-client@example.com',
    testLocation: 'Staging Lab',
    issueDate: '01/15/2026',
    expirationDate: '01/15/2027',
    fitTestType: 'QLFT',
    respiratorMfg: 'Example Mask Co',
    testingAgent: 'Bitrex',
    maskSize: 'M',
    model: 'Example-100',
    result: 'Pass',
    verificationToken: VERIFICATION_TOKEN,
  };
  const lookupKey = lookupKeyFor(fitTest.clientName, fitTest.dob, fitTest.recipientEmail);
  const fitTestData = {
    ...fitTest,
    lookupKey,
    createdAt: iso,
    updatedAt: iso,
  };

  return {
    users,
    fitTests: [{ id: FIT_TEST_ID, data: fitTestData }],
    fitTestLookups: [{
      id: lookupKey,
      data: {
        ...fitTest,
        userId: uids.tester,
        fitTestId: FIT_TEST_ID,
        lookupKey,
        testCreatedAtMs: now.getTime(),
        updatedAt: iso,
      },
    }],
    fitTestVerifications: [{
      id: VERIFICATION_TOKEN,
      data: {
        clientName: fitTest.clientName,
        testLocation: fitTest.testLocation,
        issueDate: fitTest.issueDate,
        expirationDate: fitTest.expirationDate,
        fitTestType: fitTest.fitTestType,
        respiratorMfg: fitTest.respiratorMfg,
        maskSize: fitTest.maskSize,
        model: fitTest.model,
        result: fitTest.result,
        fitTester: fitTest.fitTester,
        userId: uids.tester,
        fitTestId: FIT_TEST_ID,
        verificationToken: VERIFICATION_TOKEN,
        updatedAt: iso,
      },
    }],
  };
};

const timestampFields = new Set([
  'requestedAt',
  'createdAt',
  'updatedAt',
  'approvedAt',
]);

const withTimestamps = (admin, data) => {
  const next = { ...data };
  Object.keys(next).forEach((key) => {
    if (timestampFields.has(key) && typeof next[key] === 'string') {
      next[key] = admin.firestore.Timestamp.fromDate(new Date(next[key]));
    }
  });
  return next;
};

const ensureAuthUser = async (auth, account, password) => {
  try {
    return await auth.getUserByEmail(account.email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  return auth.createUser({
    email: account.email,
    password,
    displayName: account.name,
    emailVerified: true,
  });
};

const seedStaging = async () => {
  if (process.env.FIREBASE_PROJECT_ID) {
    assertStagingProject(process.env.FIREBASE_PROJECT_ID);
  }
  const serviceAccount = readServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  if (
    process.env.FIREBASE_PROJECT_ID
    && process.env.FIREBASE_PROJECT_ID.trim() !== serviceAccount.project_id
  ) {
    throw new Error(
      `FIREBASE_PROJECT_ID (${process.env.FIREBASE_PROJECT_ID}) does not match the service account project ${serviceAccount.project_id}.`
    );
  }

  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const password = process.env.STAGING_SEED_PASSWORD || DEFAULT_PASSWORD;
  if (password.length < 6) {
    throw new Error('STAGING_SEED_PASSWORD must be at least 6 characters.');
  }

  const auth = admin.auth();
  const db = admin.firestore();
  const uids = {};
  for (const account of ACCOUNTS) {
    const user = await ensureAuthUser(auth, account, password);
    uids[account.key] = user.uid;
  }

  const seed = buildStagingSeed(uids);
  const writer = db.bulkWriter();
  seed.users.forEach((entry) => {
    writer.set(db.collection('users').doc(entry.id), withTimestamps(admin, entry.data));
  });
  seed.fitTests.forEach((entry) => {
    writer.set(db.collection('fitTests').doc(entry.id), withTimestamps(admin, entry.data));
  });
  seed.fitTestLookups.forEach((entry) => {
    writer.set(db.collection('fitTestLookups').doc(entry.id), withTimestamps(admin, entry.data));
  });
  seed.fitTestVerifications.forEach((entry) => {
    writer.set(db.collection('fitTestVerifications').doc(entry.id), withTimestamps(admin, entry.data));
  });
  await writer.close();

  console.log(`Seeded staging project ${serviceAccount.project_id}.`);
  console.log(`Password for newly created Auth users: ${password}`);
  ACCOUNTS.forEach((account) => {
    console.log(`${account.role} ${account.status} ${account.email} uid=${uids[account.key]}`);
  });
  console.log('Public verify token: c0ffee00c0ffee00c0ffee00c0ffee00');
  console.log('Public resend identity: Fake Client, DOB 01/15/1990, fake-client@example.com');
};

if (require.main === module) {
  seedStaging().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  ACCOUNTS,
  DEFAULT_PASSWORD,
  PROD_PROJECT_ID,
  assertStagingProject,
  buildStagingSeed,
  readServiceAccount,
};
