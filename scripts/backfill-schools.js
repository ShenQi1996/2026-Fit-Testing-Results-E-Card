// Backfills users.school for testers who do not already have one, using the
// school stored on that tester's fitTests. Staging Firebase project only.
//
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/staging-service-account.json
//   npm run backfill:schools
//   npm run backfill:schools -- --write
//
// Dry run is the default. It connects to staging, reads tester users and their
// fitTests, prints every school value found with counts, the planned updates,
// and the skip list, and writes nothing. --write sets school on the user
// document and changes no other field.
//
// The school on a fit test record is schoolsList. Some records also carry
// schoolName (the saved-profile field). testLocation is a location
// (Harlem, Brooklyn, or Other) and is never read as a school. Saved
// schoolProfiles are not read.
//
// The only school this script will write is "Helene College of Nursing"
// (SCHOOLS_OPTIONS in src/constants/fitTestOptions.js). Any other value is
// unrecognized. That tester is reported and skipped. Testers with no fit
// test records, records with no school, or more than one school across
// records are skipped and reported.
//
// Credential loading matches scripts/seed-staging.js. The Admin SDK bypasses
// Firestore rules, so the project check is what keeps this off production.
// The script refuses every project except fit-test-result-e-card-staging.
// Production fit-test-result-e-card-2026 is refused before the Admin SDK
// connects and again after the app is initialized. Spark plan: run this on
// your machine. Do not commit the service account file.
//
// users.school is the single school name stored on a tester. This script does
// not import the school-scoped admin code. It only writes that field name.

const fs = require('fs');
const path = require('path');

const STAGING_PROJECT_ID = 'fit-test-result-e-card-staging';
const PROD_PROJECT_ID = 'fit-test-result-e-card-2026';

const KNOWN_SCHOOL = 'Helene College of Nursing';
const KNOWN_SCHOOLS = new Set([KNOWN_SCHOOL]);

const SCHOOL_RECORD_FIELDS = ['schoolsList', 'schoolName'];

const SKIP_REASONS = {
  NOT_TESTER: 'not-tester',
  ALREADY_HAS_SCHOOL: 'already-has-school',
  NO_RECORDS: 'no-records',
  NO_SCHOOL_ON_RECORDS: 'no-school-on-records',
  CONFLICT: 'conflict',
  UNRECOGNIZED: 'unrecognized',
};

const assertAllowedProject = (projectId) => {
  if (projectId !== STAGING_PROJECT_ID) {
    if (projectId === PROD_PROJECT_ID) {
      throw new Error(
        `Refusing to backfill production project ${PROD_PROJECT_ID}. `
        + `This script only runs when projectId is ${STAGING_PROJECT_ID}.`
      );
    }
    throw new Error(
      `Refusing to backfill project "${projectId || ''}". `
      + `This script only runs when projectId is ${STAGING_PROJECT_ID}.`
    );
  }
  return projectId;
};

const projectIdFromApp = (app) => app?.options?.projectId;

const trimmedString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const schoolsOnRecord = (record = {}) => {
  const values = [];
  SCHOOL_RECORD_FIELDS.forEach((field) => {
    const value = trimmedString(record[field]);
    if (value && !values.includes(value)) values.push(value);
  });
  return values;
};

const userHasSchool = (user = {}) => {
  if (!Object.prototype.hasOwnProperty.call(user, 'school')) return false;
  const { school } = user;
  if (school === null || school === undefined) return false;
  if (typeof school === 'string') return school.trim() !== '';
  return true;
};

const existingSchoolValue = (user = {}) => (
  typeof user.school === 'string' ? user.school.trim() : user.school
);

const compareText = (left, right) => String(left).localeCompare(String(right));

const decideTester = ({ id, user = {}, records }) => {
  const decision = {
    uid: id,
    email: trimmedString(user.email),
    name: trimmedString(user.name),
  };

  if (user.role !== 'tester') {
    return { ...decision, action: 'skip', reason: SKIP_REASONS.NOT_TESTER, schools: [] };
  }

  if (userHasSchool(user)) {
    return {
      ...decision,
      action: 'skip',
      reason: SKIP_REASONS.ALREADY_HAS_SCHOOL,
      school: existingSchoolValue(user),
      schools: [],
    };
  }

  if (!Array.isArray(records) || records.length === 0) {
    return { ...decision, action: 'skip', reason: SKIP_REASONS.NO_RECORDS, schools: [] };
  }

  const valueCounts = new Map();
  records.forEach((record) => {
    schoolsOnRecord(record).forEach((value) => {
      valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
    });
  });

  const schools = [...valueCounts.keys()].sort(compareText);
  const withCounts = { ...decision, schools, valueCounts };

  if (schools.length === 0) {
    return { ...withCounts, action: 'skip', reason: SKIP_REASONS.NO_SCHOOL_ON_RECORDS };
  }
  if (schools.length > 1) {
    return { ...withCounts, action: 'skip', reason: SKIP_REASONS.CONFLICT };
  }

  const school = schools[0];
  if (!KNOWN_SCHOOLS.has(school)) {
    return { ...withCounts, action: 'skip', reason: SKIP_REASONS.UNRECOGNIZED };
  }

  return { ...withCounts, action: 'update', school };
};

const planSchoolBackfill = (testers) => {
  const decisions = testers.map((tester) => decideTester(tester));
  const valueCounts = new Map();

  decisions.forEach((decision) => {
    if (!decision.valueCounts) return;
    decision.valueCounts.forEach((count, value) => {
      valueCounts.set(value, (valueCounts.get(value) || 0) + count);
    });
  });

  const schoolValues = [...valueCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || compareText(left.value, right.value));

  const updates = decisions
    .filter((decision) => decision.action === 'update')
    .map(({ uid, email, name, school }) => ({ uid, email, name, school }))
    .sort((left, right) => compareText(left.uid, right.uid));

  const skips = decisions
    .filter((decision) => decision.action === 'skip')
    .map(({ uid, email, name, reason, school, schools }) => ({
      uid,
      email,
      name,
      reason,
      school,
      schools: schools || [],
    }))
    .sort((left, right) => compareText(left.uid, right.uid));

  return { schoolValues, updates, skips };
};

const schoolFieldUpdate = (school) => {
  if (!KNOWN_SCHOOLS.has(school)) {
    throw new Error(`Refusing to write unrecognized school "${school || ''}".`);
  }
  return { school };
};

const identityLine = ({ uid, email, name }) => {
  const parts = [`users/${uid}`];
  if (email) parts.push(email);
  if (name) parts.push(name);
  return parts.join('  ');
};

const skipDetail = (skip) => {
  if (skip.reason === SKIP_REASONS.NO_RECORDS) return 'no fit test records';
  if (skip.reason === SKIP_REASONS.NO_SCHOOL_ON_RECORDS) {
    return 'no school on fit test records';
  }
  if (skip.reason === SKIP_REASONS.CONFLICT) {
    return `conflicting schools: ${skip.schools.join(', ')}`;
  }
  if (skip.reason === SKIP_REASONS.UNRECOGNIZED) {
    return `unrecognized school: ${skip.schools.join(', ')}`;
  }
  if (skip.reason === SKIP_REASONS.ALREADY_HAS_SCHOOL) {
    return `already has school ${JSON.stringify(skip.school)}`;
  }
  if (skip.reason === SKIP_REASONS.NOT_TESTER) return 'role is not tester';
  return skip.reason;
};

const formatSchoolBackfillReport = (plan, { write, projectId }) => {
  const lines = [
    write
      ? 'Write mode. Each planned update sets school and leaves every other field unchanged.'
      : 'Dry run only. No documents were written.',
    `Project: ${projectId}`,
        'School values found on fit tests for testers with no school (occurrences):',
  ];

  if (plan.schoolValues.length === 0) {
    lines.push('  (none)');
  } else {
    plan.schoolValues.forEach((entry) => {
      lines.push(`  ${entry.count}  ${entry.value}`);
    });
  }

  lines.push('Planned updates:');
  if (plan.updates.length === 0) {
    lines.push('  (none)');
  } else {
    plan.updates.forEach((update) => {
      lines.push(`  ${identityLine(update)}  school=${JSON.stringify(update.school)}`);
    });
  }

  lines.push('Skipped:');
  if (plan.skips.length === 0) {
    lines.push('  (none)');
  } else {
    plan.skips.forEach((skip) => {
      lines.push(`  ${identityLine(skip)}  ${skipDetail(skip)}`);
    });
  }

  return lines.join('\n');
};

const formatWriteResult = ({ written }) => {
  const lines = written.map((entry) => (
    `Wrote users/${entry.uid} school=${JSON.stringify(entry.school)}`
  ));
  lines.push(`Wrote school on ${written.length} user document(s).`);
  return lines.join('\n');
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

const parseArgs = (argv) => {
  const args = argv.slice(2);
  const known = new Set(['--write']);
  args.forEach((arg) => {
    if (!known.has(arg)) {
      throw new Error(
        `Unknown argument ${arg}. Dry run is the default. Pass --write to update user documents.`
      );
    }
  });
  return { write: args.includes('--write') };
};

const readTesters = async (db) => {
  const usersSnap = await db.collection('users').where('role', '==', 'tester').get();
  const testers = [];

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data() || {};
    if (userHasSchool(user)) {
      testers.push({ id: userDoc.id, user });
      continue;
    }

    const testsSnap = await db.collection('fitTests').where('userId', '==', userDoc.id).get();
    testers.push({
      id: userDoc.id,
      user,
      records: testsSnap.docs.map((entry) => entry.data() || {}),
    });
  }

  return testers;
};

const applySchoolUpdates = async (db, updates) => {
  const pending = updates.map((update) => ({
    uid: update.uid,
    payload: schoolFieldUpdate(update.school),
  }));
  const written = [];
  const failed = [];

  for (const update of pending) {
    try {
      await db.collection('users').doc(update.uid).update(payloadOnlySchool(update.payload));
      written.push({ uid: update.uid, school: update.payload.school });
    } catch (error) {
      failed.push({
        uid: update.uid,
        school: update.payload.school,
        message: error.message || String(error),
      });
      console.error(`Failed to set school on users/${update.uid}:`, error.message || error);
    }
  }

  return { written, failed };
};

const payloadOnlySchool = (payload) => {
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'school') {
    throw new Error('Refusing to write a user update that changes a field other than school.');
  }
  return { school: payload.school };
};

const backfillSchools = async () => {
  const { write } = parseArgs(process.argv);
  const serviceAccount = loadCredentials();

  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  const projectId = assertAllowedProject(projectIdFromApp(admin.app()));

  const db = admin.firestore();
  const plan = planSchoolBackfill(await readTesters(db));
  console.log(formatSchoolBackfillReport(plan, { write, projectId }));

  if (!write) return { plan, written: [], failed: [] };

  const result = await applySchoolUpdates(db, plan.updates);
  console.log(formatWriteResult(result));
  if (result.failed.length > 0) {
    throw new Error(`Failed to set school on ${result.failed.length} user document(s).`);
  }
  return { plan, ...result };
};

if (require.main === module) {
  backfillSchools().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  KNOWN_SCHOOL,
  KNOWN_SCHOOLS,
  PROD_PROJECT_ID,
  SCHOOL_RECORD_FIELDS,
  SKIP_REASONS,
  STAGING_PROJECT_ID,
  applySchoolUpdates,
  assertAllowedProject,
  decideTester,
  formatSchoolBackfillReport,
  formatWriteResult,
  loadCredentials,
  parseArgs,
  planSchoolBackfill,
  projectIdFromApp,
  readTesters,
  schoolFieldUpdate,
  schoolsOnRecord,
  userHasSchool,
};
