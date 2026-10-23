/**
 * Set status 'approved' on legacy users/{uid} docs that have no status.
 *
 * Run this while signed in as an admin, after the rules that use
 * resource.data.get(...) are deployed, and before relying on the app
 * that treats a missing status as pending:
 *
 *   ADMIN_EMAIL='qisam1989@gmail.com' ADMIN_PASSWORD='...' node scripts/backfillUserStatus.js
 *
 * The password is read from the environment, not from the command line.
 * Firebase Console is the other way to set the same field. This does not
 * delete or create Auth users.
 */

const LEGACY_USER_IDS = [
  'SX26kFfwDRM7OR4xVFECwg5QulG2',
  'Se0pO39E5RVY8xmy0mAScr1TdkY2',
  'Xy2DEHEJNRQNN9MAnHqTZ9imUoj2',
];

const STATUS_BACKFILL = { status: 'approved' };

const collectStatusBackfillIds = (docs, legacyIds = LEGACY_USER_IDS) => {
  const toUpdate = new Set();
  const seen = new Map();

  docs.forEach((userDoc) => {
    const data = typeof userDoc.data === 'function' ? userDoc.data() : (userDoc.data || {});
    seen.set(userDoc.id, data || {});
    if (!data?.status) toUpdate.add(userDoc.id);
  });

  legacyIds.forEach((id) => {
    if (!seen.has(id) || !seen.get(id)?.status) toUpdate.add(id);
  });

  return [...toUpdate];
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
  legacyIds = LEGACY_USER_IDS,
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
    updateDoc,
  } = require('firebase/firestore');

  const app = initializeApp(readFirebaseConfig(), `backfill-${Date.now()}`);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);

  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'users'));
  const ids = collectStatusBackfillIds(snap.docs, legacyIds);
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

  return { updated, failed };
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
  collectStatusBackfillIds,
  backfillMissingUserStatus,
  readFirebaseConfig,
};
