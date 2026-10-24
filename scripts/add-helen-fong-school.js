// Adds the school "Helen Fong" on the staging Firebase project only.
// Uses the same documents as addMasterSchool: schools/{name} plus
// schoolDirectory/names (names array and programs array).
//
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/staging-service-account.json
//   node scripts/add-helen-fong-school.js
//   node scripts/add-helen-fong-school.js --write
//
// Dry run is the default. It refuses every project except
// fit-test-result-e-card-staging, including production
// fit-test-result-e-card-2026, before the Admin SDK connects.
// Do not commit the service account file.
//
// Production: a super admin adds "Helen Fong" in Users Management with
// + Add School. That button calls addMasterSchool, which writes the school
// document and the directory together. Do not write the production project
// from this script.

const fs = require('fs');
const path = require('path');

const STAGING_PROJECT_ID = 'fit-test-result-e-card-staging';
const PROD_PROJECT_ID = 'fit-test-result-e-card-2026';
const HELEN_FONG_SCHOOL_NAME = 'Helen Fong';

const assertAllowedProject = (projectId) => {
  if (projectId !== STAGING_PROJECT_ID) {
    if (projectId === PROD_PROJECT_ID) {
      throw new Error(
        `Refusing to add a school on production project ${PROD_PROJECT_ID}. `
        + `This script only runs when projectId is ${STAGING_PROJECT_ID}.`
      );
    }
    throw new Error(
      `Refusing to add a school on project "${projectId || ''}". `
      + `This script only runs when projectId is ${STAGING_PROJECT_ID}.`
    );
  }
  return projectId;
};

const blankProgram = (name) => ({
  name,
  programAdministratorName: '',
  programAdministratorContact: '',
});

const readProgram = (entry) => ({
  name: typeof entry?.name === 'string' ? entry.name : '',
  programAdministratorName: typeof entry?.programAdministratorName === 'string'
    ? entry.programAdministratorName
    : '',
  programAdministratorContact: typeof entry?.programAdministratorContact === 'string'
    ? entry.programAdministratorContact
    : '',
});

/**
 * Same shape addMasterSchool writes. Existing schools keep their program fields.
 * @param {{ names?: string[], programs?: object[], schoolExists?: boolean }} current
 */
const planHelenFongWrite = (current = {}) => {
  const names = Array.isArray(current.names)
    ? current.names.filter((name) => typeof name === 'string' && name.trim())
    : [];
  const programs = Array.isArray(current.programs) ? current.programs.map(readProgram) : [];
  const alreadyPresent = current.schoolExists === true || names.includes(HELEN_FONG_SCHOOL_NAME);
  if (alreadyPresent) {
    return { alreadyPresent: true, names, programs, school: null };
  }
  const nextNames = [...names, HELEN_FONG_SCHOOL_NAME].sort((a, b) => a.localeCompare(b));
  const nextPrograms = [
    ...programs.filter((entry) => entry.name && entry.name !== HELEN_FONG_SCHOOL_NAME),
    blankProgram(HELEN_FONG_SCHOOL_NAME),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return {
    alreadyPresent: false,
    names: nextNames,
    programs: nextPrograms,
    school: blankProgram(HELEN_FONG_SCHOOL_NAME),
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

const parseArgs = (argv) => {
  const write = argv.slice(2).includes('--write');
  return { dryRun: !write };
};

const addHelenFongSchool = async () => {
  const { dryRun } = parseArgs(process.argv);
  const serviceAccount = loadCredentials();
  assertAllowedProject(serviceAccount.project_id);

  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  assertAllowedProject(admin.app().options.projectId);

  const db = admin.firestore();
  const schoolRef = db.collection('schools').doc(HELEN_FONG_SCHOOL_NAME);
  const directoryRef = db.collection('schoolDirectory').doc('names');
  const [schoolSnap, directorySnap] = await Promise.all([schoolRef.get(), directoryRef.get()]);
  const directory = directorySnap.exists ? directorySnap.data() || {} : {};
  const plan = planHelenFongWrite({
    names: directory.names,
    programs: directory.programs,
    schoolExists: schoolSnap.exists,
  });

  if (plan.alreadyPresent) {
    console.log(`"${HELEN_FONG_SCHOOL_NAME}" is already on the staging school list. Nothing to write.`);
    return plan;
  }

  if (dryRun) {
    console.log(`Dry run only. Would add "${HELEN_FONG_SCHOOL_NAME}" on ${STAGING_PROJECT_ID}.`);
    console.log(`schools/${HELEN_FONG_SCHOOL_NAME} and schoolDirectory/names`);
    return plan;
  }

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  batch.set(schoolRef, {
    ...plan.school,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(directoryRef, {
    names: plan.names,
    programs: plan.programs,
    updatedAt: now,
  });
  await batch.commit();
  console.log(`Added "${HELEN_FONG_SCHOOL_NAME}" on ${STAGING_PROJECT_ID}.`);
  return plan;
};

if (require.main === module) {
  addHelenFongSchool().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  HELEN_FONG_SCHOOL_NAME,
  PROD_PROJECT_ID,
  STAGING_PROJECT_ID,
  assertAllowedProject,
  planHelenFongWrite,
};
