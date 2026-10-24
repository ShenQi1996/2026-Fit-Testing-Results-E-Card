// Seeds Firestore on the staging Firebase project only.
// Idempotent: fixed document ids, set() overwrites those docs, nothing else is deleted.
//
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/staging-service-account.json
//   npm run seed:staging -- --dry-run
//   npm run seed:staging
//   SEED_PASSWORD from the environment, then: npm run seed:staging -- --with-auth
//
// Spark plan: run this on your machine. Do not commit the service account file.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STAGING_PROJECT_ID = 'fit-test-result-e-card-staging';
const PROD_PROJECT_ID = 'fit-test-result-e-card-2026';

const SIGNATURE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const USER_ISO = '2026-01-10T15:00:00.000Z';

const ACCOUNTS = [
  {
    id: 'seed-user-superadmin',
    email: 'test-person-01@example.com',
    name: 'Test Person 01',
    role: 'superadmin',
    status: 'approved',
    provider: 'google.com',
  },
  {
    id: 'seed-user-admin',
    email: 'test-person-02@example.com',
    name: 'Test Person 02',
    role: 'admin',
    status: 'approved',
    provider: 'password',
  },
  {
    id: 'seed-user-tester',
    email: 'test-person-03@example.com',
    name: 'Test Person 03',
    role: 'tester',
    status: 'approved',
    provider: 'password',
  },
  {
    id: 'seed-user-pending',
    email: 'test-person-04@example.com',
    name: 'Test Person 04',
    role: 'tester',
    status: 'pending',
    provider: 'password',
  },
];

const TESTER_ID = 'seed-user-tester';
const SUPERADMIN_ID = 'seed-user-superadmin';
const FIT_TESTER_NAME = 'Test Person 03';

const TIMESTAMP_FIELDS = new Set(['createdAt', 'updatedAt', 'approvedAt', 'requestedAt']);

const assertAllowedProject = (projectId) => {
  if (projectId !== STAGING_PROJECT_ID) {
    if (projectId === PROD_PROJECT_ID) {
      throw new Error(
        `Refusing to seed production project ${PROD_PROJECT_ID}. `
        + `This script only runs when projectId is ${STAGING_PROJECT_ID}.`
      );
    }
    throw new Error(
      `Refusing to seed project "${projectId || ''}". `
      + `This script only runs when projectId is ${STAGING_PROJECT_ID}.`
    );
  }
  return projectId;
};

const parseDateString = (dateString) => {
  if (!dateString) return null;
  const parts = String(dateString).split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if ([month, day, year].some((value) => Number.isNaN(value))) return null;
  return new Date(year, month, day);
};

const normalizeClientName = (name = '') => String(name).trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeDob = (dob = '') => {
  const trimmed = String(dob).trim();
  if (!parseDateString(trimmed) || trimmed.length !== 10) return '';
  return trimmed;
};

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

// Same payload as src/utils/lookupKey.js: name|MM/DD/YYYY|email, SHA-256 hex.
const buildLookupKey = (clientName, dob, recipientEmail) => {
  const name = normalizeClientName(clientName);
  const birthDate = normalizeDob(dob);
  const email = normalizeEmail(recipientEmail);
  if (!name || !birthDate || !email) {
    throw new Error(`Cannot build a lookup key for ${clientName}.`);
  }
  return crypto.createHash('sha256').update(`${name}|${birthDate}|${email}`).digest('hex');
};

const expirationFromIssueDate = (issueDate) => {
  const issued = parseDateString(issueDate);
  if (!issued) throw new Error(`Invalid issue date ${issueDate}.`);
  const expiration = new Date(issued);
  expiration.setFullYear(expiration.getFullYear() + 1);
  const month = String(expiration.getMonth() + 1).padStart(2, '0');
  const day = String(expiration.getDate()).padStart(2, '0');
  return `${month}/${day}/${expiration.getFullYear()}`;
};

const assertFitTestId = (id) => {
  if (!/^[A-Za-z0-9]{20}$/.test(id)) {
    throw new Error(`Fit test id "${id}" must be 20 alphanumeric characters.`);
  }
};

const assertToken = (token) => {
  if (!/^[a-f0-9]{32}$/.test(token)) {
    throw new Error(`verificationToken "${token}" must be 32 hex characters.`);
  }
};

const legacyFields = (spec) => ({
  clientName: spec.clientName,
  dob: spec.dob,
  fitTestType: 'N95',
  fitTester: spec.fitTester,
  issueDate: spec.issueDate,
  lookupKey: buildLookupKey(spec.clientName, spec.dob, spec.recipientEmail),
  maskSize: spec.maskSize,
  model: spec.model,
  printedName: spec.clientName,
  recipientEmail: spec.recipientEmail,
  respiratorMfg: spec.respiratorMfg,
  result: spec.result || 'Pass',
  signatureDataUrl: SIGNATURE_PLACEHOLDER,
  testingAgent: spec.testingAgent,
  userId: spec.userId,
  verificationToken: spec.verificationToken,
  createdAt: spec.createdAt,
  updatedAt: spec.updatedAt,
});

const protocolFields = (spec) => ({
  cleaningMethod: 'Condition acceptable',
  correctiveActionNote: spec.correctiveActionNote || '',
  expirationDate: spec.expirationDate,
  failureReason: spec.failureReason || '',
  fitTestMethod: 'Locked to Qualitative',
  programAdministratorContact: 'test-person-02@example.com',
  programAdministratorName: 'Test Person 02',
  schoolsList: 'Example Training School',
  solutionExpirationDate: spec.solutionExpirationDate,
  solutionOpenDate: spec.solutionOpenDate,
  solutionType: spec.testingAgent,
  testerSignatureDataUrl: SIGNATURE_PLACEHOLDER,
  employeeSealCheckInstructionProvided: true,
  exerciseBendingOverOrJogging: true,
  exerciseDeepBreathing: true,
  exerciseHeadSideToSide: true,
  exerciseHeadUpAndDown: true,
  exerciseNormalBreathing: true,
  exerciseNormalBreathingAgain: true,
  exerciseTalking: true,
  facialHairInterfering: Boolean(spec.facialHairInterfering),
  hoodCleaned: true,
  nebulizerCleaned: true,
  respiratorDonnedCorrectly: spec.respiratorDonnedCorrectly !== false,
  schoolsOnFile: true,
  sensitivityDetected: true,
  sensitivityScreeningPerformed: true,
  studentClearanceConfirmed: spec.result !== 'Fail',
  testerAttestationProtocolFollowed: true,
  testerAttestationRespiratorMatchesRecord: true,
});

const consentFields = (spec) => ({
  consentToFitTest: true,
  optionalMarketingEmail: false,
  optionalOrganizationRelease: Boolean(spec.optionalOrganizationRelease),
  privacyPolicyAcknowledged: true,
  recordDeliveryConfirmed: true,
  testerAttestationConsentWitnessed: true,
  testerMedicalRestrictionsReceived: Boolean(spec.testerMedicalRestrictionsReceived),
  organizationReleaseRecipient: spec.organizationReleaseRecipient || '',
  testerMedicalRestrictionsNote: spec.testerMedicalRestrictionsNote || '',
});

const fitTestData = (spec) => {
  assertFitTestId(spec.id);
  assertToken(spec.verificationToken);
  const legacy = legacyFields(spec);
  if (spec.generation === 'legacy') return legacy;

  const full = {
    ...legacy,
    ...protocolFields(spec),
  };
  if (spec.testLocation) full.testLocation = spec.testLocation;

  if (spec.generation === 'full') {
    full.testerAttestationMedicalClearanceVerified = true;
    return full;
  }

  if (spec.generation === 'newest') {
    return {
      ...full,
      ...consentFields(spec),
    };
  }

  throw new Error(`Unknown fit test generation ${spec.generation}.`);
};

const FIT_TEST_SPECS = [
  {
    id: 'seedftlegacy00000001',
    generation: 'legacy',
    olderLookup: true,
    clientName: 'Test Person 11',
    dob: '02/02/1991',
    recipientEmail: 'test-person-11@example.com',
    fitTester: FIT_TESTER_NAME,
    issueDate: '03/01/2024',
    maskSize: 'Regular',
    model: '1860',
    respiratorMfg: '3M',
    result: 'Pass',
    testingAgent: 'Bitrex',
    verificationToken: 'a1000000000000000000000000000001',
    userId: TESTER_ID,
    createdAt: '2024-03-01T15:00:00.000Z',
    updatedAt: '2024-03-01T15:00:00.000Z',
  },
  {
    id: 'seedftfull0000000001',
    generation: 'full',
    clientName: 'Test Person 12',
    dob: '04/04/1992',
    recipientEmail: 'test-person-12@example.com',
    fitTester: FIT_TESTER_NAME,
    issueDate: '06/15/2025',
    expirationDate: '06/15/2026',
    maskSize: 'Small',
    model: 'DC365',
    respiratorMfg: 'Honeywell',
    result: 'Pass',
    testingAgent: 'Saccharin',
    testLocation: 'Harlem',
    verificationToken: 'a1000000000000000000000000000002',
    userId: TESTER_ID,
    solutionOpenDate: '06/01/2025',
    solutionExpirationDate: '06/01/2026',
    createdAt: '2025-06-15T15:00:00.000Z',
    updatedAt: '2025-06-15T15:00:00.000Z',
  },
  {
    id: 'seedftnoloc000000001',
    generation: 'full',
    clientName: 'Test Person 13',
    dob: '06/06/1993',
    recipientEmail: 'test-person-13@example.com',
    fitTester: FIT_TESTER_NAME,
    issueDate: '08/20/2025',
    expirationDate: '08/20/2026',
    maskSize: 'Regular',
    model: '9500',
    respiratorMfg: 'Makrite sekura',
    result: 'Pass',
    testingAgent: 'Bitrex',
    verificationToken: 'a1000000000000000000000000000003',
    userId: TESTER_ID,
    solutionOpenDate: '08/01/2025',
    solutionExpirationDate: '08/01/2026',
    createdAt: '2025-08-20T15:00:00.000Z',
    updatedAt: '2025-08-20T15:00:00.000Z',
  },
  {
    id: 'seedftnewest00000001',
    generation: 'newest',
    clientName: 'Test Person 14',
    dob: '08/08/1994',
    recipientEmail: 'test-person-14@example.com',
    fitTester: FIT_TESTER_NAME,
    issueDate: '02/01/2026',
    expirationDate: '02/01/2027',
    maskSize: 'Regular',
    model: '8210',
    respiratorMfg: '3M',
    result: 'Pass',
    testingAgent: 'Bitrex',
    testLocation: 'Brooklyn',
    verificationToken: 'a1000000000000000000000000000004',
    userId: TESTER_ID,
    optionalOrganizationRelease: true,
    organizationReleaseRecipient: 'Example Clinic',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'Example restriction note',
    solutionOpenDate: '01/02/2026',
    solutionExpirationDate: '01/02/2027',
    createdAt: '2026-02-01T15:00:00.000Z',
    updatedAt: '2026-02-01T15:00:00.000Z',
  },
  {
    id: 'seedftfail0000000001',
    generation: 'newest',
    clientName: 'Test Person 15',
    dob: '10/10/1995',
    recipientEmail: 'test-person-15@example.com',
    fitTester: FIT_TESTER_NAME,
    issueDate: '03/10/2026',
    expirationDate: '03/10/2027',
    maskSize: 'Small',
    model: 'H910',
    respiratorMfg: 'Honeywell',
    result: 'Fail',
    testingAgent: 'Saccharin',
    testLocation: 'Harlem',
    facialHairInterfering: true,
    respiratorDonnedCorrectly: false,
    failureReason: 'Taste detected',
    correctiveActionNote: 'Example corrective note',
    verificationToken: 'a1000000000000000000000000000005',
    userId: TESTER_ID,
    solutionOpenDate: '03/01/2026',
    solutionExpirationDate: '03/01/2027',
    createdAt: '2026-03-10T15:00:00.000Z',
    updatedAt: '2026-03-10T15:00:00.000Z',
  },
];

const lookupDoc = (fitTest, fitTestId, older) => {
  const data = {
    clientName: fitTest.clientName,
    dob: fitTest.dob,
    fitTestId,
    fitTestType: fitTest.fitTestType,
    fitTester: fitTest.fitTester,
    issueDate: fitTest.issueDate,
    lookupKey: fitTest.lookupKey,
    maskSize: fitTest.maskSize,
    model: fitTest.model,
    recipientEmail: fitTest.recipientEmail,
    respiratorMfg: fitTest.respiratorMfg,
    result: fitTest.result,
    testingAgent: fitTest.testingAgent,
    userId: fitTest.userId,
    updatedAt: fitTest.updatedAt,
  };
  if (fitTest.expirationDate) data.expirationDate = fitTest.expirationDate;
  if (fitTest.testLocation) data.testLocation = fitTest.testLocation;
  if (!older) {
    data.verificationToken = fitTest.verificationToken;
    data.testCreatedAtMs = Date.parse(fitTest.createdAt);
  }
  if (!/^[a-f0-9]{64}$/.test(fitTest.lookupKey)) {
    throw new Error(`lookupKey for ${fitTestId} is not 64 hex characters.`);
  }
  return {
    path: `fitTestLookups/${fitTest.lookupKey}`,
    data,
  };
};

const verificationDoc = (fitTest, fitTestId) => ({
  path: `fitTestVerifications/${fitTest.verificationToken}`,
  data: {
    clientName: fitTest.clientName,
    expirationDate: fitTest.expirationDate || expirationFromIssueDate(fitTest.issueDate),
    fitTestId,
    fitTestType: fitTest.fitTestType,
    fitTester: fitTest.fitTester,
    issueDate: fitTest.issueDate,
    maskSize: fitTest.maskSize,
    model: fitTest.model,
    respiratorMfg: fitTest.respiratorMfg,
    result: fitTest.result,
    testLocation: fitTest.testLocation || '',
    userId: fitTest.userId,
    verificationToken: fitTest.verificationToken,
    updatedAt: fitTest.updatedAt,
  },
});

const userDoc = (account) => {
  const data = {
    createdAt: USER_ISO,
    updatedAt: USER_ISO,
    email: account.email,
    name: account.name,
    role: account.role,
    status: account.status,
    requestedAt: USER_ISO,
    provider: account.provider,
  };
  if (account.status === 'approved') {
    data.approvedAt = USER_ISO;
    data.approvedBy = SUPERADMIN_ID;
  }
  return { path: `users/${account.id}`, data };
};

const profileDocs = () => ([
  {
    path: `users/${TESTER_ID}/solutionProfiles/seed-solution-01`,
    data: {
      solutionType: 'Bitrex',
      solutionOpenDate: '01/02/2026',
      solutionExpirationDate: '07/02/2026',
      isDefault: true,
      orderIndex: 0,
      createdAt: USER_ISO,
      updatedAt: USER_ISO,
    },
  },
  {
    path: `users/${TESTER_ID}/solutionProfiles/seed-solution-02`,
    data: {
      solutionType: 'Saccharin',
      solutionOpenDate: '02/02/2026',
      solutionExpirationDate: '08/02/2026',
      isDefault: false,
      orderIndex: 1,
      createdAt: USER_ISO,
      updatedAt: USER_ISO,
    },
  },
]);

const buildSeedPlan = () => {
  const users = ACCOUNTS.map(userDoc);
  const profiles = profileDocs();
  const fitTests = [];
  const fitTestLookups = [];
  const fitTestVerifications = [];

  FIT_TEST_SPECS.forEach((spec) => {
    const data = fitTestData(spec);
    fitTests.push({ path: `fitTests/${spec.id}`, data });
    fitTestLookups.push(lookupDoc(data, spec.id, Boolean(spec.olderLookup)));
    fitTestVerifications.push(verificationDoc(data, spec.id));
  });

  const documents = [
    ...users,
    ...profiles,
    ...fitTests,
    ...fitTestLookups,
    ...fitTestVerifications,
  ];

  const paths = documents.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) {
    throw new Error('Seed document paths are not unique.');
  }

  return {
    accounts: ACCOUNTS,
    users,
    profiles,
    fitTests,
    fitTestLookups,
    fitTestVerifications,
    documents,
  };
};

const loadCredentials = () => {
  if (process.env.FIREBASE_PROJECT_ID) {
    assertAllowedProject(String(process.env.FIREBASE_PROJECT_ID).trim());
  }

  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!filePath || !String(filePath).trim()) {
    throw new Error(
      'Set GOOGLE_APPLICATION_CREDENTIALS to the staging service account JSON path. Do not commit that file.'
    );
  }

  const resolved = path.resolve(String(filePath).trim());
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read the service account JSON at ${resolved}.`);
  }
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('Service account JSON is missing client_email, private_key, or project_id.');
  }
  assertAllowedProject(parsed.project_id);
  return parsed;
};

const requireSeedPassword = () => {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error('Set SEED_PASSWORD for --with-auth. This script does not contain a password.');
  }
  if (String(password).length < 6) {
    throw new Error('SEED_PASSWORD must be at least 6 characters.');
  }
  return password;
};

const parseArgs = (argv) => {
  const args = argv.slice(2);
  const known = new Set(['--dry-run', '--with-auth']);
  args.forEach((arg) => {
    if (!known.has(arg)) {
      throw new Error(`Unknown argument ${arg}. Supported flags: --dry-run, --with-auth.`);
    }
  });
  return {
    dryRun: args.includes('--dry-run'),
    withAuth: args.includes('--with-auth'),
  };
};

const toFirestoreData = (admin, data) => {
  const next = {};
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (TIMESTAMP_FIELDS.has(key) && typeof value === 'string') {
      next[key] = admin.firestore.Timestamp.fromDate(new Date(value));
      return;
    }
    next[key] = value;
  });
  return next;
};

const ensureAuthUsers = async (auth, accounts, password) => {
  for (const account of accounts) {
    try {
      const existing = await auth.getUser(account.id);
      if (existing.email && existing.email.toLowerCase() !== account.email) {
        throw new Error(
          `Auth uid ${account.id} already exists as ${existing.email}. Not changing or deleting it.`
        );
      }
      await auth.updateUser(account.id, {
        email: account.email,
        displayName: account.name,
        password,
        emailVerified: true,
        disabled: false,
      });
      console.log(`Updated auth user ${account.email} uid=${account.id}`);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      try {
        await auth.createUser({
          uid: account.id,
          email: account.email,
          displayName: account.name,
          password,
          emailVerified: true,
          disabled: false,
        });
        console.log(`Created auth user ${account.email} uid=${account.id}`);
      } catch (createError) {
        if (createError.code === 'auth/email-already-exists') {
          throw new Error(
            `Auth email ${account.email} belongs to a different uid. Not deleting that user.`
          );
        }
        throw createError;
      }
    }
  }
};

const writeDocuments = async (admin, documents) => {
  const db = admin.firestore();
  const writer = db.bulkWriter();
  documents.forEach((entry) => {
    writer.set(db.doc(entry.path), toFirestoreData(admin, entry.data));
  });
  await writer.close();
};

const printPlan = (plan, { projectId, dryRun, withAuth }) => {
  const mode = dryRun ? 'Dry run only. No documents were written.' : 'Wrote seed documents with set().';
  console.log(mode);
  console.log(`Project: ${projectId}`);
  console.log(`Documents: ${plan.documents.length}. Non-seed documents are left untouched.`);
  plan.documents.forEach((entry) => {
    console.log(`${entry.path} [${Object.keys(entry.data).sort().join(', ')}]`);
  });
  const newest = plan.fitTests.find((entry) => entry.path.endsWith('seedftnewest00000001'));
  if (newest) {
    console.log(
      `Resend check: ${newest.data.clientName}, DOB ${newest.data.dob}, ${newest.data.recipientEmail}`
    );
    console.log(`Verify token: ${newest.data.verificationToken}`);
  }
  if (withAuth) {
    console.log(dryRun
      ? 'A real run with --with-auth would create or update Auth users for the four seed uids. Set SEED_PASSWORD. It is not printed.'
      : 'Auth users were created or updated for the four seed uids. The password is SEED_PASSWORD and is not printed.');
  } else {
    console.log('Auth users were not changed. Pass --with-auth and SEED_PASSWORD to create matching accounts.');
  }
};

const seedStaging = async () => {
  const { dryRun, withAuth } = parseArgs(process.argv);
  const serviceAccount = loadCredentials();
  const plan = buildSeedPlan();

  if (dryRun) {
    printPlan(plan, {
      projectId: serviceAccount.project_id,
      dryRun: true,
      withAuth,
    });
    return;
  }

  const password = withAuth ? requireSeedPassword() : null;
  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  assertAllowedProject(admin.app().options.projectId);

  if (withAuth) {
    await ensureAuthUsers(admin.auth(), plan.accounts, password);
  }
  await writeDocuments(admin, plan.documents);
  printPlan(plan, {
    projectId: admin.app().options.projectId,
    dryRun: false,
    withAuth,
  });
};

if (require.main === module) {
  seedStaging().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  ACCOUNTS,
  PROD_PROJECT_ID,
  STAGING_PROJECT_ID,
  assertAllowedProject,
  buildLookupKey,
  buildSeedPlan,
  expirationFromIssueDate,
  parseArgs,
};
