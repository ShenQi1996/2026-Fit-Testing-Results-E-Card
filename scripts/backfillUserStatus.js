/**
 * Set status 'approved' on legacy users/{uid} docs that are real profiles
 * and have no status yet.
 *
 * Run this while signed in as an approved super admin, after the rules that
 * require status == 'approved' are deployed, and before relying on the app
 * that treats a missing or unknown status as pending:
 *
 *   ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='...' npm run backfill:user-status
 *
 * The password is read from the environment, not from the command line.
 * A plain admin cannot update admin or super admin profiles, so this script
 * refuses to run unless the signed-in user is an approved super admin.
 *
 * The signed-in super admin's own document is skipped. Rules do not let
 * anyone change their own status from the client. Set that document in the
 * Firebase console when it is missing (the super admin profile was already
 * confirmed on Oct 23, 2026).
 *
 * A document is updated only when it has a role of tester, admin, or
 * superadmin and at least one profile field other than role and the
 * setUserRole timestamps (email, name, or provider). Role-only documents
 * written by setUserRole, which have not been reviewed, are left alone so
 * they stay pending. Documents with no role are left alone. A status that
 * is already set is left alone. Known legacy ids that the users query does
 * not return are not guessed at, because their role cannot be checked.
 *
 * This does not delete or create Auth users.
 */

const LEGACY_USER_IDS = [
  'SX26kFfwDRM7OR4xVFECwg5QulG2',
  'Se0pO39E5RVY8xmy0mAScr1TdkY2',
  'Xy2DEHEJNRQNN9MAnHqTZ9imUoj2',
];

const STATUS_BACKFILL = { status: 'approved' };
const PROFILE_ROLES = new Set(['tester', 'admin', 'superadmin']);
const ROLE_ONLY_KEYS = new Set(['role', 'createdAt', 'updatedAt']);

const docData = (userDoc) => (
  typeof userDoc.data === 'function' ? (userDoc.data() || {}) : (userDoc.data || {})
);

const presentKeys = (data) => Object.keys(data).filter((key) => (
  data[key] !== undefined && data[key] !== null && data[key] !== ''
));

/**
 * Role-only setUserRole writes store role plus optional timestamps and have
 * not been reviewed. They must not be approved by this script.
 */
const isUnreviewedRoleOnlyDoc = (data) => {
  const keys = presentKeys(data);
  return keys.length > 0 && keys.every((key) => ROLE_ONLY_KEYS.has(key));
};

/**
 * Missing status on a real profile (a recognized role plus email, name, or
 * provider). Unknown or empty status counts as missing.
 */
const shouldBackfillStatus = (data) => {
  if (!data || data.status) return false;
  if (!PROFILE_ROLES.has(data.role)) return false;
  if (isUnreviewedRoleOnlyDoc(data)) return false;
  return true;
};

const assertApprovedSuperAdmin = (data) => {
  if (data?.role !== 'superadmin' || data?.status !== 'approved') {
    throw new Error(
      'Sign in as an approved super admin. A plain admin cannot update admin or super admin profiles.'
    );
  }
};

const collectStatusBackfillIds = (docs, { skipIds = [] } = {}) => {
  const skip = new Set(skipIds);
  const toUpdate = [];

  docs.forEach((userDoc) => {
    if (skip.has(userDoc.id)) return;
    if (shouldBackfillStatus(docData(userDoc))) toUpdate.push(userDoc.id);
  });

  return toUpdate;
};

const readFirebaseConfig = () => {
  // firebase.js resolves this through webpack. The script runs in Node and
  // always targets the production project, which is where the legacy docs are.
  const { PROD_FIREBASE_CONFIG } = require('../src/config/prodFirebaseConfig');
  return PROD_FIREBASE_CONFIG;
};

const backfillMissingUserStatus = async ({
  email,
  password,
} = {}) => {
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  }

  const { initializeApp } = require('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
  const {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
  } = require('firebase/firestore');

  const app = initializeApp(readFirebaseConfig(), `backfill-${Date.now()}`);
  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const selfId = credential.user.uid;

  const db = getFirestore(app);
  const selfSnap = await getDoc(doc(db, 'users', selfId));
  assertApprovedSuperAdmin(selfSnap.exists() ? selfSnap.data() : {});

  const snap = await getDocs(collection(db, 'users'));
  const qualifying = collectStatusBackfillIds(snap.docs);
  const ids = qualifying.filter((id) => id !== selfId);
  if (qualifying.includes(selfId)) {
    console.log(
      `Skipped users/${selfId}. Rules do not allow changing your own status. Set it in the Firebase console if it is missing.`
    );
  }

  const updated = [];
  const failed = [];

  for (const id of ids) {
    try {
      await updateDoc(doc(db, 'users', id), STATUS_BACKFILL);
      updated.push(id);
    } catch (error) {
      console.error(`Failed to set status on users/${id}:`, error);
      failed.push(id);
    }
  }

  return { updated, failed, skippedSelf: qualifying.includes(selfId) };
};

const main = async () => {
  const result = await backfillMissingUserStatus({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  console.log(`Updated ${result.updated.length} user profile(s).`);
  if (result.updated.length) console.log(result.updated.join('\n'));
  if (result.failed.length) {
    console.error(`Failed ${result.failed.length}: ${result.failed.join(', ')}`);
    process.exitCode = 1;
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  LEGACY_USER_IDS,
  STATUS_BACKFILL,
  shouldBackfillStatus,
  assertApprovedSuperAdmin,
  collectStatusBackfillIds,
  backfillMissingUserStatus,
  readFirebaseConfig,
};
