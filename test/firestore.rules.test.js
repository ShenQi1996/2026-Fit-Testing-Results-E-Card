import fs from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const RULES = fs.readFileSync('firestore.rules', 'utf8');

let testEnv;

const seed = async (writes) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const defaults = [
      ['schoolDirectory/names', { names: [HELENE, SECOND] }],
      [`schools/${HELENE}`, { name: HELENE }],
      [`schools/${SECOND}`, { name: SECOND }],
    ];
    const byPath = new Map();
    for (const entry of [...defaults, ...writes]) {
      byPath.set(entry[0], entry[1]);
    }
    for (const [path, data] of byPath) {
      await setDoc(doc(db, path), data);
    }
  });
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-fit-test-rules',
    firestore: { rules: RULES },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const HELENE = 'Helene College of Nursing';
const SECOND = 'Example Second School';

const approved = (role, email, extra = {}) => ({ role, status: 'approved', email, ...extra });

const scopedAdmin = (schools = [HELENE], email = 'admin@example.com') => (
  approved('admin', email, { schools })
);

const testerAt = (school, extra = {}) => ({
  role: 'tester',
  status: 'pending',
  email: 'tester@example.com',
  school,
  ...extra,
});

const respiratorRecord = (extra = {}) => ({
  respiratorMfg: '3M',
  model: '1860',
  style: 'Filtering facepiece',
  maskSize: 'Regular',
  fitTestMethod: 'Qualitative',
  ...extra,
});

test('a regular admin can approve a tester', async () => {
  await seed([
    ['users/admin-1', scopedAdmin()],
    ['users/tester-1', testerAt(HELENE)],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
});

test('a regular admin cannot grant admin', async () => {
  await seed([
    ['users/admin-1', scopedAdmin()],
    ['users/tester-1', testerAt(HELENE)],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { role: 'admin' }));
});

test('a regular admin cannot update an admin or super admin doc', async () => {
  await seed([
    ['users/admin-1', scopedAdmin()],
    ['users/admin-2', scopedAdmin([HELENE], 'other@example.com')],
    ['users/super-1', approved('superadmin', 'sam@example.com')],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/admin-2'), { name: 'Renamed' }));
  await assertFails(updateDoc(doc(db, 'users/super-1'), { name: 'Renamed' }));
});

test('a regular admin cannot create an admin profile', async () => {
  await seed([
    ['users/admin-1', scopedAdmin()],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(setDoc(doc(db, 'users/new-admin'), {
    role: 'admin',
    status: 'approved',
    email: 'new@example.com',
  }));
  await assertSucceeds(setDoc(doc(db, 'users/new-tester'), {
    role: 'tester',
    status: 'pending',
    email: 'new-tester@example.com',
    school: HELENE,
  }));
});

test('a super admin can grant and revoke admin, but cannot create a super admin', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/tester-1', { role: 'tester', status: 'approved', email: 'tester@example.com' }],
    ['users/admin-2', approved('admin', 'other@example.com')],
  ]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/tester-1'), { role: 'admin' }));
  await assertSucceeds(updateDoc(doc(db, 'users/admin-2'), { role: 'tester' }));
  await assertSucceeds(setDoc(doc(db, 'users/new-admin'), {
    role: 'admin',
    status: 'approved',
    email: 'new-admin@example.com',
  }));
  await assertFails(setDoc(doc(db, 'users/super-2'), {
    role: 'superadmin',
    status: 'approved',
    email: 'second@example.com',
  }));
});

test('a super admin cannot update someone else to superadmin', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/admin-2', approved('admin', 'other@example.com')],
    ['users/tester-1', { role: 'tester', status: 'approved', email: 'tester@example.com' }],
    ['users/legacy-1', { email: 'legacy@example.com', name: 'Legacy' }],
  ]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/admin-2'), { role: 'superadmin' }));
  await assertFails(updateDoc(doc(db, 'users/tester-1'), { role: 'superadmin' }));
  await assertFails(updateDoc(doc(db, 'users/legacy-1'), { role: 'superadmin' }));
});

test('a regular admin cannot set a role to superadmin', async () => {
  await seed([
    ['users/admin-1', scopedAdmin()],
    ['users/tester-1', testerAt(HELENE)],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { role: 'superadmin' }));
});

test('an owner cannot promote themselves to superadmin', async () => {
  await seed([
    ['users/tester-1', { role: 'tester', status: 'approved', email: 'tester@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('tester-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { role: 'superadmin' }));
});

test('a super admin cannot demote or delete themselves', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
  ]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/super-1'), { role: 'admin' }));
  await assertFails(deleteDoc(doc(db, 'users/super-1')));
  await assertSucceeds(updateDoc(doc(db, 'users/super-1'), {
    name: 'Samuel',
    role: 'superadmin',
  }));
});

test('another super admin can demote a super admin', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/super-2', approved('superadmin', 'second@example.com')],
  ]);
  const db = testEnv.authenticatedContext('super-2').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/super-1'), { role: 'admin' }));
});

test('a regular admin can delete a tester but not an admin', async () => {
  await seed([
    ['users/admin-1', scopedAdmin()],
    ['users/tester-1', testerAt(HELENE, { status: 'approved' })],
    ['users/admin-2', scopedAdmin([HELENE], 'other@example.com')],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(deleteDoc(doc(db, 'users/tester-1')));
  await assertFails(deleteDoc(doc(db, 'users/admin-2')));
});

test('an owner cannot change their own role or status', async () => {
  await seed([
    ['users/tester-1', { role: 'tester', status: 'pending', email: 'tester@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('tester-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { role: 'admin' }));
  await assertFails(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
  await assertSucceeds(updateDoc(doc(db, 'users/tester-1'), { name: 'Tester Name' }));
});

test('a rejected admin is not treated as staff', async () => {
  await seed([
    ['users/admin-1', { role: 'admin', status: 'rejected', email: 'admin@example.com' }],
    ['users/tester-1', { role: 'tester', status: 'pending', email: 'tester@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
});

test('an admin with no status cannot manage testers', async () => {
  await seed([
    ['users/admin-1', { role: 'admin', email: 'admin@example.com' }],
    ['users/tester-1', { role: 'tester', email: 'tester@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
});

test('a regular admin cannot edit a tester name or email', async () => {
  await seed([
    ['users/admin-1', scopedAdmin()],
    ['users/tester-1', testerAt(HELENE, { name: 'Tester' })],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { name: 'Renamed' }));
  await assertFails(updateDoc(doc(db, 'users/tester-1'), { email: 'other@example.com' }));
  await assertSucceeds(updateDoc(doc(db, 'users/tester-1'), {
    status: 'approved',
    approvedBy: 'admin-1',
  }));
});

test('a super admin can edit a tester name', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/tester-1', { role: 'tester', status: 'approved', email: 'tester@example.com', name: 'Tester' }],
  ]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/tester-1'), { name: 'Renamed' }));
});

test('an owner cannot create themselves as admin or superadmin', async () => {
  const db = testEnv.authenticatedContext('new-user').firestore();

  await assertFails(setDoc(doc(db, 'users/new-user'), {
    role: 'admin',
    status: 'approved',
    email: 'new@example.com',
  }));
  await assertFails(setDoc(doc(db, 'users/new-user'), {
    role: 'superadmin',
    status: 'approved',
    email: 'new@example.com',
  }));
  await assertSucceeds(setDoc(doc(db, 'users/new-user'), {
    role: 'tester',
    status: 'pending',
    email: 'new@example.com',
  }));
});

test('a tester cannot create a superadmin document', async () => {
  await seed([
    ['users/tester-1', { role: 'tester', status: 'approved', email: 'tester@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('tester-1').firestore();

  await assertFails(setDoc(doc(db, 'users/super-2'), {
    role: 'superadmin',
    status: 'approved',
    email: 'second@example.com',
  }));
});

test('an admin cannot escalate their own role', async () => {
  await seed([
    ['users/admin-1', approved('admin', 'admin@example.com')],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/admin-1'), { role: 'superadmin' }));
});

test('a pending super admin cannot grant admin', async () => {
  await seed([
    ['users/super-1', { role: 'superadmin', status: 'pending', email: 'sam@example.com' }],
    ['users/tester-1', { role: 'tester', status: 'pending', email: 'tester@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { role: 'admin' }));
});

test('a missing role field does not block an owner name update', async () => {
  await seed([['users/staff-1', { email: 'staff@example.com' }]]);
  const db = testEnv.authenticatedContext('staff-1').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/staff-1'), { name: 'Staff' }));
});

test('an owner with no status can update their name', async () => {
  await seed([
    ['users/staff-1', { role: 'tester', email: 'staff@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('staff-1').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/staff-1'), { name: 'Staff' }));
});

const backfill = {
  email: 'staff@example.com',
  name: 'Staff',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

test('role-only doc owner can write the sign-in backfill', async () => {
  await seed([['users/staff-1', { role: 'tester' }]]);
  const db = testEnv.authenticatedContext('staff-1').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/staff-1'), backfill));
});

test('approved doc without approvedBy can write the sign-in backfill', async () => {
  await seed([[
    'users/staff-2',
    { role: 'tester', status: 'approved', email: 'old@example.com' },
  ]]);
  const db = testEnv.authenticatedContext('staff-2').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/staff-2'), {
    ...backfill,
    email: 'staff2@example.com',
  }));
});

test('owner cannot approve themselves', async () => {
  await seed([['users/staff-3', { role: 'tester', status: 'pending' }]]);
  const db = testEnv.authenticatedContext('staff-3').firestore();

  await assertFails(updateDoc(doc(db, 'users/staff-3'), { status: 'approved' }));
});

test('owner cannot grant themselves admin', async () => {
  await seed([['users/staff-4', { role: 'tester', status: 'approved' }]]);
  const db = testEnv.authenticatedContext('staff-4').firestore();

  await assertFails(updateDoc(doc(db, 'users/staff-4'), { role: 'admin' }));
});

test('a role-only user is not approved for fit test reads', async () => {
  await seed([
    ['users/staff-1', { role: 'tester' }],
    ['fitTests/test-1', { userId: 'staff-1' }],
  ]);
  const db = testEnv.authenticatedContext('staff-1').firestore();

  await assertFails(getDoc(doc(db, 'fitTests/test-1')));
});

test('an unknown status is not approved for fit test reads', async () => {
  await seed([
    ['users/staff-1', { role: 'tester', status: 'active' }],
    ['fitTests/test-1', { userId: 'staff-1' }],
  ]);
  const db = testEnv.authenticatedContext('staff-1').firestore();

  await assertFails(getDoc(doc(db, 'fitTests/test-1')));
});

test('an admin with no status cannot approve their own doc', async () => {
  await seed([[
    'users/admin-1',
    { role: 'admin', email: 'admin@example.com', name: 'Admin' },
  ]]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/admin-1'), { status: 'approved' }));
});

test('an approved super admin can set status on another profile', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/legacy-1', { role: 'admin', email: 'other@example.com', name: 'Other' }],
  ]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/legacy-1'), { status: 'approved' }));
});

test('a super admin cannot fill in their own missing status', async () => {
  await seed([[
    'users/super-1',
    { role: 'superadmin', email: 'sam@example.com', name: 'Sam' },
  ]]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/super-1'), { status: 'approved' }));
});

test('a scoped admin can read and update a tester in their schools', async () => {
  await seed([
    ['users/admin-1', scopedAdmin()],
    ['users/tester-1', testerAt(HELENE, { name: 'Tess' })],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(getDoc(doc(db, 'users/tester-1')));
  await assertSucceeds(updateDoc(doc(db, 'users/tester-1'), {
    status: 'approved',
    approvedBy: 'admin-1',
  }));
});

test('a scoped admin cannot read or update a tester from another school', async () => {
  await seed([
    ['users/admin-1', scopedAdmin([HELENE])],
    ['users/tester-1', testerAt(SECOND)],
    ['users/tester-blank', { role: 'tester', status: 'pending', email: 'blank@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(getDocs(collection(db, 'users')));
  await assertFails(getDoc(doc(db, 'users/tester-1')));
  await assertFails(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
  await assertFails(getDoc(doc(db, 'users/tester-blank')));
  await assertFails(deleteDoc(doc(db, 'users/tester-1')));
});

test('a scoped admin can manage an admin whose schools are within theirs', async () => {
  await seed([
    ['users/admin-1', scopedAdmin([HELENE, SECOND])],
    ['users/admin-2', scopedAdmin([HELENE], 'other@example.com')],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(getDoc(doc(db, 'users/admin-2')));
  await assertSucceeds(updateDoc(doc(db, 'users/admin-2'), { status: 'rejected' }));
  await assertFails(updateDoc(doc(db, 'users/admin-2'), { name: 'Renamed' }));
  await assertFails(deleteDoc(doc(db, 'users/admin-2')));
});

test('a scoped admin cannot manage an admin outside their schools', async () => {
  await seed([
    ['users/admin-1', scopedAdmin([HELENE])],
    ['users/admin-wide', scopedAdmin([HELENE, SECOND], 'wide@example.com')],
    ['users/admin-other', scopedAdmin([SECOND], 'other@example.com')],
    ['users/admin-empty', approved('admin', 'empty@example.com', { schools: [] })],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(getDoc(doc(db, 'users/admin-wide')));
  await assertFails(updateDoc(doc(db, 'users/admin-wide'), { status: 'rejected' }));
  await assertFails(getDoc(doc(db, 'users/admin-other')));
  await assertFails(updateDoc(doc(db, 'users/admin-other'), { status: 'rejected' }));
  await assertFails(getDoc(doc(db, 'users/admin-empty')));
});

test('a super admin bypasses school scope', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/tester-1', testerAt(SECOND)],
    ['users/tester-blank', { role: 'tester', status: 'pending', email: 'blank@example.com' }],
    ['users/admin-2', scopedAdmin([SECOND], 'other@example.com')],
  ]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(getDoc(doc(db, 'users/tester-1')));
  await assertSucceeds(getDoc(doc(db, 'users/tester-blank')));
  await assertSucceeds(updateDoc(doc(db, 'users/tester-blank'), { status: 'approved' }));
  await assertSucceeds(getDocs(collection(db, 'users')));
  await assertSucceeds(updateDoc(doc(db, 'users/admin-2'), { name: 'Renamed' }));
});

test('only a super admin can set or change school tags', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com', { schools: [HELENE] })],
    ['users/super-2', approved('superadmin', 'second@example.com')],
    ['users/admin-1', scopedAdmin()],
    ['users/tester-1', testerAt(HELENE)],
    ['users/owner-1', testerAt(HELENE, { status: 'approved', email: 'owner@example.com' })],
  ]);
  const superDb = testEnv.authenticatedContext('super-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
  const freshDb = testEnv.authenticatedContext('fresh-1').firestore();

  await assertFails(updateDoc(doc(adminDb, 'users/tester-1'), { school: SECOND }));
  await assertFails(updateDoc(doc(adminDb, 'users/admin-1'), { schools: [SECOND] }));
  await assertFails(updateDoc(doc(ownerDb, 'users/owner-1'), { school: SECOND }));
  await assertSucceeds(updateDoc(doc(ownerDb, 'users/owner-1'), { name: 'Owner' }));
  await assertFails(updateDoc(doc(superDb, 'users/super-1'), { schools: [SECOND] }));
  await assertSucceeds(updateDoc(doc(superDb, 'users/tester-1'), { school: SECOND }));
  await assertSucceeds(updateDoc(doc(superDb, 'users/admin-1'), { schools: [HELENE, SECOND] }));
  await assertSucceeds(updateDoc(doc(superDb, 'users/super-2'), { schools: [SECOND] }));

  await assertFails(setDoc(doc(freshDb, 'users/fresh-1'), {
    role: 'tester',
    status: 'pending',
    email: 'fresh@example.com',
    school: HELENE,
  }));
  await assertSucceeds(setDoc(doc(superDb, 'users/new-admin'), {
    role: 'admin',
    status: 'approved',
    email: 'new-admin@example.com',
    schools: [HELENE],
  }));
  await assertFails(setDoc(doc(superDb, 'users/super-3'), {
    role: 'superadmin',
    status: 'approved',
    email: 'third@example.com',
    schools: [HELENE],
  }));
});

const daysFromNow = (days) => Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

const datedAdmin = (extra) => approved('admin', 'window@example.com', { schools: [HELENE], ...extra });

test('an admin whose access end date has passed cannot manage other users', async () => {
  await seed([
    ['users/expired-admin', datedAdmin({ endDate: daysFromNow(-1) })],
    ['users/tester-1', testerAt(HELENE)],
  ]);
  const db = testEnv.authenticatedContext('expired-admin').firestore();

  await assertSucceeds(getDoc(doc(db, 'users/expired-admin')));
  await assertFails(getDoc(doc(db, 'users/tester-1')));
  await assertFails(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
  await assertFails(getDocs(query(
    collection(db, 'users'),
    where('role', '==', 'tester'),
    where('school', 'in', [HELENE]),
  )));
});

test('an admin whose access start date is in the future cannot manage other users', async () => {
  await seed([
    ['users/future-admin', datedAdmin({ startDate: daysFromNow(2), endDate: daysFromNow(10) })],
    ['users/tester-1', testerAt(HELENE)],
  ]);
  const db = testEnv.authenticatedContext('future-admin').firestore();

  await assertSucceeds(getDoc(doc(db, 'users/future-admin')));
  await assertFails(getDoc(doc(db, 'users/tester-1')));
  await assertFails(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
  await assertFails(getDocs(query(
    collection(db, 'users'),
    where('role', '==', 'tester'),
    where('school', 'in', [HELENE]),
  )));
});

test('an admin inside the access window and an admin with no dates can manage in-scope testers', async () => {
  await seed([
    ['users/active-admin', datedAdmin({
      email: 'active@example.com',
      startDate: daysFromNow(-2),
      endDate: daysFromNow(2),
    })],
    ['users/open-admin', scopedAdmin([HELENE], 'open@example.com')],
    ['users/tester-1', testerAt(HELENE)],
    ['users/tester-2', testerAt(HELENE, { email: 'two@example.com' })],
  ]);
  const activeDb = testEnv.authenticatedContext('active-admin').firestore();
  const openDb = testEnv.authenticatedContext('open-admin').firestore();

  await assertSucceeds(updateDoc(doc(activeDb, 'users/tester-1'), { status: 'approved' }));
  await assertSucceeds(getDocs(query(
    collection(activeDb, 'users'),
    where('role', '==', 'tester'),
    where('school', 'in', [HELENE]),
  )));
  await assertSucceeds(updateDoc(doc(openDb, 'users/tester-2'), { status: 'approved' }));
});

test('a super admin is not limited by access dates', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com', {
      startDate: daysFromNow(3),
      endDate: daysFromNow(-3),
    })],
    ['users/tester-1', testerAt(HELENE)],
    ['users/admin-1', scopedAdmin()],
  ]);
  const db = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(getDocs(collection(db, 'users')));
  await assertSucceeds(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
  await assertSucceeds(updateDoc(doc(db, 'users/admin-1'), { status: 'rejected' }));
});

test('only a super admin can set or clear admin access dates', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/admin-1', scopedAdmin()],
    ['users/admin-2', scopedAdmin([HELENE], 'other@example.com')],
    ['users/tester-1', testerAt(HELENE)],
  ]);
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const superDb = testEnv.authenticatedContext('super-1').firestore();

  await assertFails(updateDoc(doc(adminDb, 'users/admin-1'), { endDate: daysFromNow(10) }));
  await assertFails(updateDoc(doc(adminDb, 'users/admin-2'), {
    status: 'approved',
    endDate: daysFromNow(10),
  }));
  await assertFails(updateDoc(doc(adminDb, 'users/tester-1'), { startDate: daysFromNow(-1) }));
  await assertFails(setDoc(doc(adminDb, 'users/new-tester'), {
    role: 'tester',
    status: 'pending',
    email: 'new@example.com',
    school: HELENE,
    startDate: daysFromNow(-1),
  }));
  await assertFails(updateDoc(doc(superDb, 'users/super-1'), { endDate: daysFromNow(10) }));
  await assertSucceeds(updateDoc(doc(superDb, 'users/admin-2'), {
    startDate: daysFromNow(-1),
    endDate: daysFromNow(10),
  }));
  await assertSucceeds(updateDoc(doc(superDb, 'users/admin-2'), {
    startDate: deleteField(),
    endDate: deleteField(),
  }));
  await assertSucceeds(setDoc(doc(superDb, 'users/new-admin'), {
    role: 'admin',
    status: 'approved',
    email: 'new-admin@example.com',
    schools: [HELENE],
    startDate: daysFromNow(-1),
    endDate: daysFromNow(30),
  }));
});

test('scoped admin lists are limited to testers in their schools', async () => {
  await seed([
    ['users/admin-1', scopedAdmin([HELENE, SECOND])],
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/tester-1', testerAt(HELENE)],
    ['users/tester-2', testerAt(SECOND)],
    ['users/tester-other', testerAt('C')],
  ]);
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const superDb = testEnv.authenticatedContext('super-1').firestore();
  const adminUsers = collection(adminDb, 'users');

  await assertFails(getDocs(adminUsers));
  await assertFails(getDocs(query(adminUsers, where('school', '==', 'C'))));
  await assertFails(getDocs(query(adminUsers, where('role', '==', 'superadmin'))));
  await assertFails(getDocs(query(
    adminUsers,
    where('role', '==', 'tester'),
    where('school', 'in', [HELENE, 'C']),
  )));
  await assertSucceeds(getDocs(query(
    adminUsers,
    where('role', '==', 'tester'),
    where('school', 'in', [HELENE, SECOND]),
  )));
  await assertSucceeds(getDocs(collection(superDb, 'users')));
});

test('a scoped admin must tag a new tester with one of their schools', async () => {
  await seed([
    ['users/admin-one', scopedAdmin([HELENE], 'one@example.com')],
    ['users/admin-none', approved('admin', 'none@example.com', { schools: [] })],
    ['users/super-1', approved('superadmin', 'sam@example.com')],
  ]);
  const oneDb = testEnv.authenticatedContext('admin-one').firestore();
  const noneDb = testEnv.authenticatedContext('admin-none').firestore();
  const superDb = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(setDoc(doc(oneDb, 'users/tester-tagged'), {
    role: 'tester',
    status: 'pending',
    email: 'tagged@example.com',
    school: HELENE,
  }));
  await assertFails(setDoc(doc(oneDb, 'users/tester-missing'), {
    role: 'tester',
    status: 'pending',
    email: 'missing@example.com',
  }));
  await assertFails(setDoc(doc(oneDb, 'users/tester-out'), {
    role: 'tester',
    status: 'pending',
    email: 'out@example.com',
    school: SECOND,
  }));
  await assertFails(setDoc(doc(noneDb, 'users/tester-none'), {
    role: 'tester',
    status: 'pending',
    email: 'none@example.com',
    school: HELENE,
  }));
  await assertSucceeds(setDoc(doc(superDb, 'users/tester-super'), {
    role: 'tester',
    status: 'pending',
    email: 'super-tester@example.com',
  }));
});

test('only a super admin can write the master school list', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/admin-1', scopedAdmin()],
    ['users/tester-1', testerAt(HELENE, { status: 'approved' })],
    ['users/pending-1', { role: 'tester', status: 'pending', email: 'pending@example.com' }],
  ]);
  const superDb = testEnv.authenticatedContext('super-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const testerDb = testEnv.authenticatedContext('tester-1').firestore();
  const pendingDb = testEnv.authenticatedContext('pending-1').firestore();
  const guestDb = testEnv.unauthenticatedContext().firestore();
  const created = 'Created Training School';
  const renamed = 'Renamed Training School';

  await assertSucceeds(setDoc(doc(superDb, 'schools', created), { name: created }));
  await assertSucceeds(setDoc(doc(superDb, 'schools', renamed), { name: renamed }));
  await assertSucceeds(deleteDoc(doc(superDb, 'schools', created)));
  await assertFails(setDoc(doc(superDb, 'schools', 'mismatch'), { name: 'other spelling' }));
  await assertSucceeds(setDoc(doc(superDb, 'schoolDirectory', 'names'), { names: [HELENE, renamed] }));
  await assertFails(deleteDoc(doc(superDb, 'schoolDirectory', 'names')));
  await assertFails(setDoc(doc(superDb, 'schoolDirectory', 'other'), { names: [HELENE] }));

  await assertSucceeds(getDoc(doc(adminDb, 'schools', HELENE)));
  await assertSucceeds(getDoc(doc(testerDb, 'schools', HELENE)));
  await assertFails(setDoc(doc(adminDb, 'schools', created), { name: created }));
  await assertFails(updateDoc(doc(adminDb, 'schools', HELENE), { name: HELENE }));
  await assertFails(deleteDoc(doc(adminDb, 'schools', HELENE)));
  await assertFails(setDoc(doc(testerDb, 'schools', created), { name: created }));
  await assertFails(deleteDoc(doc(testerDb, 'schools', SECOND)));
  await assertFails(getDoc(doc(pendingDb, 'schools', HELENE)));
  await assertFails(getDoc(doc(guestDb, 'schools', HELENE)));
  await assertFails(setDoc(doc(guestDb, 'schools', created), { name: created }));
});

test('school tags must be current master-list names', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/admin-1', scopedAdmin([HELENE, SECOND])],
    ['users/admin-one', scopedAdmin([HELENE], 'one@example.com')],
    ['users/tester-1', testerAt(HELENE)],
  ]);
  const superDb = testEnv.authenticatedContext('super-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(superDb, 'users/tester-1'), { school: '' }));
  await assertFails(updateDoc(doc(superDb, 'users/tester-1'), { school: 'Helene College of Nursin' }));
  await assertSucceeds(updateDoc(doc(superDb, 'users/tester-1'), { school: SECOND }));
  await assertFails(updateDoc(doc(superDb, 'users/admin-1'), { schools: [] }));
  await assertFails(updateDoc(doc(superDb, 'users/admin-1'), { schools: [HELENE, 'Not A School'] }));
  await assertSucceeds(updateDoc(doc(superDb, 'users/admin-1'), { schools: [HELENE] }));
  await assertFails(setDoc(doc(superDb, 'users/super-1'), {
    role: 'superadmin',
    status: 'approved',
    email: 'sam@example.com',
    schools: [HELENE],
  }));

  await assertSucceeds(updateDoc(doc(adminDb, 'users/admin-1'), { name: 'Still Ada' }));
  await assertFails(updateDoc(doc(adminDb, 'users/admin-1'), { schools: [SECOND] }));

  await seed([
    ['users/admin-1', scopedAdmin([HELENE, SECOND])],
    ['users/admin-one', scopedAdmin([HELENE], 'one@example.com')],
    ['schoolDirectory/names', { names: [HELENE] }],
  ]);
  const removedDb = testEnv.authenticatedContext('admin-1').firestore();
  await assertFails(setDoc(doc(removedDb, 'users/tester-removed'), {
    role: 'tester',
    status: 'pending',
    email: 'removed@example.com',
    school: SECOND,
  }));
  await assertSucceeds(setDoc(doc(testEnv.authenticatedContext('admin-one').firestore(), 'users/tester-kept'), {
    role: 'tester',
    status: 'pending',
    email: 'kept@example.com',
    school: HELENE,
  }));
});

test('renamed or removed school names stay readable until the field changes', async () => {
  const oldName = 'Old Training School';
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/tester-1', testerAt(oldName, { status: 'approved', name: 'Tess' })],
    ['users/admin-1', scopedAdmin([oldName])],
    ['fitTests/old-1', { userId: 'tester-1', schoolsList: oldName }],
    ['schoolDirectory/names', { names: [HELENE] }],
  ]);
  const testerDb = testEnv.authenticatedContext('tester-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const superDb = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(getDoc(doc(testerDb, 'users/tester-1')));
  await assertSucceeds(getDoc(doc(adminDb, 'fitTests/old-1')));
  await assertSucceeds(updateDoc(doc(superDb, 'users/tester-1'), { name: 'Tess Updated' }));
  await assertSucceeds(updateDoc(doc(testerDb, 'fitTests/old-1'), { result: 'Pass' }));
  await assertFails(updateDoc(doc(superDb, 'users/tester-1'), { school: 'Another Missing School' }));
  await assertFails(updateDoc(doc(testerDb, 'fitTests/old-1'), { schoolsList: 'Another Missing School' }));
  await assertSucceeds(setDoc(doc(testerDb, 'fitTests/new-1'), {
    userId: 'tester-1',
    schoolsList: HELENE,
    creatorRole: 'tester',
    creatorSchool: oldName,
    ...respiratorRecord(),
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/new-2'), {
    userId: 'tester-1',
    schoolsList: 'Not On The List',
    creatorRole: 'tester',
    creatorSchool: oldName,
    ...respiratorRecord(),
  }));
  await assertSucceeds(setDoc(doc(testerDb, 'fitTests/blank-1'), {
    userId: 'tester-1',
    schoolsList: '',
    creatorRole: 'tester',
    creatorSchool: oldName,
    ...respiratorRecord(),
  }));
});

test('fitTests count queries follow the same read rules as document reads', async () => {
  await seed([
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['users/admin-1', scopedAdmin()],
    ['fitTests/own-1', { userId: 'tester-1' }],
    ['fitTests/other-1', { userId: 'admin-1' }],
  ]);
  const testerDb = testEnv.authenticatedContext('tester-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(getCountFromServer(query(
    collection(testerDb, 'fitTests'),
    where('userId', '==', 'tester-1'),
  )));
  await assertFails(getCountFromServer(query(
    collection(testerDb, 'fitTests'),
    where('userId', '==', 'admin-1'),
  )));
  await assertSucceeds(getCountFromServer(query(
    collection(adminDb, 'fitTests'),
    where('userId', '==', 'tester-1'),
  )));
});

const commitSoftDelete = (db, fitTestId, actorId, ownerId, reason, deletedAt = serverTimestamp(), schoolsList = HELENE) => {
  const batch = writeBatch(db);
  batch.update(doc(db, `fitTests/${fitTestId}`), {
    deletedAt,
    deletedBy: actorId,
    deleteReason: reason,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, `fitTestDeletionLogs/${fitTestId}`), {
    fitTestId,
    userId: ownerId,
    schoolsList,
    deletedAt,
    deletedBy: actorId,
    deleteReason: reason,
  });
  return batch.commit();
};

test('fit test records are soft-deleted with a reason and cannot be hard-deleted', async () => {
  await seed([
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['users/admin-1', scopedAdmin()],
    ['users/admin-2', scopedAdmin([SECOND], 'other-admin@example.com')],
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/other-1', approved('tester', 'other@example.com', { school: SECOND })],
    ['fitTests/own-1', { userId: 'tester-1', result: 'Pass', schoolsList: HELENE }],
    ['fitTests/own-2', { userId: 'tester-1', result: 'Fail', schoolsList: HELENE }],
    ['fitTests/second-1', { userId: 'other-1', result: 'Pass', schoolsList: SECOND }],
    ['fitTests/blank-school', { userId: 'tester-1', result: 'Pass' }],
    ['fitTestLookups/lookup-1', { userId: 'tester-1', fitTestId: 'own-1' }],
    ['fitTestVerifications/abc', { userId: 'tester-1', fitTestId: 'own-1', result: 'Pass' }],
  ]);
  const testerDb = testEnv.authenticatedContext('tester-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const otherAdminDb = testEnv.authenticatedContext('admin-2').firestore();
  const superDb = testEnv.authenticatedContext('super-1').firestore();
  const otherDb = testEnv.authenticatedContext('other-1').firestore();
  const deletedAt = Timestamp.fromDate(new Date('2026-10-25T12:00:00Z'));

  await assertFails(deleteDoc(doc(testerDb, 'fitTests/own-1')));
  await assertFails(deleteDoc(doc(adminDb, 'fitTests/own-1')));
  await assertFails(deleteDoc(doc(adminDb, 'fitTestLookups/lookup-1')));
  await assertFails(deleteDoc(doc(testerDb, 'fitTestLookups/lookup-1')));
  await assertFails(deleteDoc(doc(adminDb, 'fitTestVerifications/abc')));
  await assertFails(deleteDoc(doc(testerDb, 'fitTestVerifications/abc')));
  await assertFails(setDoc(doc(testerDb, 'fitTests/created-deleted'), {
    userId: 'tester-1',
    schoolsList: HELENE,
    deletedAt,
    deletedBy: 'tester-1',
    deleteReason: 'Should not be on create',
  }));
  await assertFails(commitSoftDelete(testerDb, 'own-2', 'tester-1', 'tester-1', 'Duplicate entry'));
  await assertFails(commitSoftDelete(otherDb, 'own-1', 'other-1', 'tester-1', 'Not my record'));
  await assertFails(commitSoftDelete(otherAdminDb, 'own-1', 'admin-2', 'tester-1', 'Outside my schools'));
  await assertFails(commitSoftDelete(adminDb, 'blank-school', 'admin-1', 'tester-1', 'No school on the record'));
  await assertFails(commitSoftDelete(
    adminDb,
    'own-1',
    'admin-1',
    'tester-1',
    'Wrong participant',
    deletedAt,
  ));
  await assertFails(commitSoftDelete(adminDb, 'own-1', 'admin-1', 'tester-1', '   '));
  await assertFails(updateDoc(doc(adminDb, 'fitTests/own-1'), {
    deletedAt: serverTimestamp(),
    deletedBy: 'admin-1',
    deleteReason: 'Missing the log',
    updatedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(adminDb, 'fitTestDeletionLogs/own-1'), {
    fitTestId: 'own-1',
    userId: 'tester-1',
    deletedAt: serverTimestamp(),
    deletedBy: 'admin-1',
    deleteReason: 'Log without the delete',
  }));

  await assertSucceeds(commitSoftDelete(adminDb, 'own-1', 'admin-1', 'tester-1', 'Wrong participant'));
  await assertSucceeds(getDoc(doc(adminDb, 'fitTests/own-1')));
  await assertSucceeds(getDoc(doc(adminDb, 'fitTestDeletionLogs/own-1')));
  await assertSucceeds(getDoc(doc(testerDb, 'fitTestDeletionLogs/own-1')));
  await assertFails(getDoc(doc(otherAdminDb, 'fitTestDeletionLogs/own-1')));
  await assertSucceeds(getDocs(query(
    collection(adminDb, 'fitTestDeletionLogs'),
    where('schoolsList', '==', HELENE),
  )));
  await assertFails(getDocs(query(
    collection(otherAdminDb, 'fitTestDeletionLogs'),
    where('schoolsList', '==', HELENE),
  )));
  await assertFails(getDocs(collection(adminDb, 'fitTestDeletionLogs')));
  await assertSucceeds(getDocs(collection(superDb, 'fitTestDeletionLogs')));
  await assertFails(updateDoc(doc(adminDb, 'fitTests/own-1'), { result: 'Fail' }));
  await assertFails(deleteDoc(doc(adminDb, 'fitTests/own-1')));
  await assertFails(updateDoc(doc(adminDb, 'fitTestDeletionLogs/own-1'), { deleteReason: 'Changed' }));
  await assertFails(deleteDoc(doc(adminDb, 'fitTestDeletionLogs/own-1')));
  await assertSucceeds(commitSoftDelete(superDb, 'second-1', 'super-1', 'other-1', 'Super admin removal', serverTimestamp(), SECOND));
  await assertSucceeds(updateDoc(doc(adminDb, 'fitTestLookups/lookup-1'), {
    revokedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(doc(adminDb, 'fitTestVerifications/abc'), {
    revokedAt: serverTimestamp(),
  }));
});

test('new fit tests require make, model, style, size, test type, and a fit factor when quantitative', async () => {
  await seed([
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
  ]);
  const testerDb = testEnv.authenticatedContext('tester-1').firestore();

  await assertFails(setDoc(doc(testerDb, 'fitTests/missing-model'), {
    userId: 'tester-1',
    ...respiratorRecord({ model: '' }),
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/quant-missing'), {
    userId: 'tester-1',
    ...respiratorRecord({ fitTestMethod: 'Quantitative' }),
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/quant-string'), {
    userId: 'tester-1',
    ...respiratorRecord({ fitTestMethod: 'Quantitative', fitFactor: '100' }),
  }));
  await assertSucceeds(setDoc(doc(testerDb, 'fitTests/quant-ok'), {
    userId: 'tester-1',
    creatorRole: 'tester',
    creatorSchool: HELENE,
    ...respiratorRecord({ fitTestMethod: 'Quantitative', fitFactor: 100 }),
  }));
  await assertSucceeds(setDoc(doc(testerDb, 'fitTests/qual-ok'), {
    userId: 'tester-1',
    creatorRole: 'tester',
    creatorSchool: HELENE,
    ...respiratorRecord(),
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/spaces'), {
    userId: 'tester-1',
    ...respiratorRecord({ model: '   ' }),
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/factor-zero'), {
    userId: 'tester-1',
    ...respiratorRecord({ fitTestMethod: 'Quantitative', fitFactor: 0 }),
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/factor-high'), {
    userId: 'tester-1',
    ...respiratorRecord({ fitTestMethod: 'Quantitative', fitFactor: 100001 }),
  }));
  await assertSucceeds(setDoc(doc(testerDb, 'fitTests/factor-max'), {
    userId: 'tester-1',
    creatorRole: 'tester',
    creatorSchool: HELENE,
    ...respiratorRecord({ fitTestMethod: 'Quantitative', fitFactor: 100000 }),
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/qual-factor'), {
    userId: 'tester-1',
    ...respiratorRecord({ fitFactor: 10 }),
  }));
});

test('an update cannot blank model or style or put a fit factor on a qualitative test', async () => {
  await seed([
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['fitTests/stamped', {
      userId: 'tester-1',
      ...respiratorRecord(),
    }],
    ['fitTests/legacy', { userId: 'tester-1', result: 'Pass' }],
  ]);
  const testerDb = testEnv.authenticatedContext('tester-1').firestore();

  await assertFails(updateDoc(doc(testerDb, 'fitTests/stamped'), { model: '' }));
  await assertFails(updateDoc(doc(testerDb, 'fitTests/stamped'), { style: '   ' }));
  await assertFails(updateDoc(doc(testerDb, 'fitTests/stamped'), { respiratorMfg: '' }));
  await assertFails(updateDoc(doc(testerDb, 'fitTests/stamped'), { maskSize: deleteField() }));
  await assertFails(updateDoc(doc(testerDb, 'fitTests/stamped'), { fitTestMethod: deleteField() }));
  await assertFails(updateDoc(doc(testerDb, 'fitTests/stamped'), { fitTestMethod: '   ' }));
  await assertFails(updateDoc(doc(testerDb, 'fitTests/stamped'), { fitFactor: 100 }));
  await assertSucceeds(updateDoc(doc(testerDb, 'fitTests/stamped'), { model: '1870' }));
  await assertSucceeds(updateDoc(doc(testerDb, 'fitTests/stamped'), { respiratorMfg: 'Honeywell' }));
  await assertSucceeds(updateDoc(doc(testerDb, 'fitTests/legacy'), { result: 'Fail' }));
});

test('a new fit test stamps the creator role and school, and those stamps stay put', async () => {
  await seed([
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['users/admin-1', scopedAdmin([HELENE])],
  ]);
  const testerDb = testEnv.authenticatedContext('tester-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(setDoc(doc(testerDb, 'fitTests/missing'), {
    userId: 'tester-1',
    schoolsList: HELENE,
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/spoof'), {
    userId: 'tester-1',
    schoolsList: HELENE,
    creatorRole: 'admin',
    creatorSchool: SECOND,
  }));
  await assertSucceeds(setDoc(doc(testerDb, 'fitTests/ok'), {
    userId: 'tester-1',
    schoolsList: SECOND,
    creatorRole: 'tester',
    creatorSchool: HELENE,
    ...respiratorRecord(),
  }));
  await assertFails(updateDoc(doc(testerDb, 'fitTests/ok'), { creatorSchool: SECOND }));
  await assertFails(updateDoc(doc(adminDb, 'fitTests/ok'), { creatorRole: 'admin' }));
  await assertSucceeds(updateDoc(doc(adminDb, 'fitTests/ok'), { result: 'Pass' }));

  await assertSucceeds(setDoc(doc(adminDb, 'fitTests/admin-card'), {
    userId: 'admin-1',
    schoolsList: HELENE,
    creatorRole: 'admin',
    creatorSchool: HELENE,
    ...respiratorRecord(),
  }));
  await assertFails(setDoc(doc(adminDb, 'fitTests/admin-spoof'), {
    userId: 'admin-1',
    schoolsList: HELENE,
    creatorRole: 'admin',
    creatorSchool: SECOND,
  }));
});

test('faculty can read their stamped school and cannot write tests or users', async () => {
  await seed([
    ['users/faculty-1', approved('faculty', 'faculty@example.com', { school: HELENE })],
    ['users/faculty-2', approved('faculty', 'other@example.com', { school: SECOND })],
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['users/admin-1', scopedAdmin([HELENE])],
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['fitTests/stamped', {
      userId: 'tester-1',
      creatorRole: 'tester',
      creatorSchool: HELENE,
      schoolsList: HELENE,
    }],
    ['fitTests/legacy', { userId: 'faculty-1', schoolsList: HELENE }],
    ['fitTests/other-school', {
      userId: 'faculty-1',
      creatorRole: 'tester',
      creatorSchool: SECOND,
    }],
  ]);
  const facultyDb = testEnv.authenticatedContext('faculty-1').firestore();
  const otherDb = testEnv.authenticatedContext('faculty-2').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const superDb = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(getDoc(doc(facultyDb, 'fitTests/stamped')));
  await assertFails(getDoc(doc(otherDb, 'fitTests/stamped')));
  await assertFails(getDoc(doc(facultyDb, 'fitTests/legacy')));
  await assertFails(getDoc(doc(facultyDb, 'fitTests/other-school')));
  await assertSucceeds(getDocs(query(
    collection(facultyDb, 'fitTests'),
    where('creatorSchool', '==', HELENE),
    orderBy('createdAt', 'desc'),
    limit(100),
  )));
  await assertFails(getDocs(query(
    collection(facultyDb, 'fitTests'),
    where('creatorSchool', '==', SECOND),
    orderBy('createdAt', 'desc'),
    limit(100),
  )));

  await assertFails(setDoc(doc(facultyDb, 'fitTests/new'), {
    userId: 'faculty-1',
    schoolsList: HELENE,
    creatorRole: 'faculty',
    creatorSchool: HELENE,
  }));
  await assertFails(updateDoc(doc(facultyDb, 'fitTests/stamped'), { result: 'Pass' }));
  await assertFails(deleteDoc(doc(facultyDb, 'fitTests/stamped')));
  await assertFails(updateDoc(doc(facultyDb, 'users/tester-1'), { status: 'rejected' }));
  await assertFails(setDoc(doc(facultyDb, 'fitTestLookups/abc'), { userId: 'faculty-1' }));

  await assertSucceeds(updateDoc(doc(adminDb, 'users/tester-1'), { role: 'faculty' }));
  await assertSucceeds(getDoc(doc(facultyDb, 'fitTests/stamped')));
  const creatorDb = testEnv.authenticatedContext('tester-1').firestore();
  await assertSucceeds(getDoc(doc(creatorDb, 'fitTests/stamped')));

  await assertSucceeds(updateDoc(doc(superDb, 'users/tester-1'), { role: 'faculty', school: SECOND }));
  const movedDb = testEnv.authenticatedContext('tester-1').firestore();
  await assertFails(getDoc(doc(movedDb, 'fitTests/stamped')));
  await assertSucceeds(getDoc(doc(facultyDb, 'fitTests/stamped')));
});

test('admins can create faculty inside their schools', async () => {
  await seed([
    ['users/admin-1', scopedAdmin([HELENE])],
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/tester-1', testerAt(HELENE)],
  ]);
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const superDb = testEnv.authenticatedContext('super-1').firestore();

  await assertSucceeds(setDoc(doc(adminDb, 'users/faculty-new'), {
    role: 'faculty',
    status: 'pending',
    email: 'new-faculty@example.com',
    school: HELENE,
  }));
  await assertFails(setDoc(doc(adminDb, 'users/faculty-out'), {
    role: 'faculty',
    status: 'pending',
    email: 'out@example.com',
    school: SECOND,
  }));
  await assertSucceeds(getDocs(query(
    collection(adminDb, 'users'),
    where('role', '==', 'faculty'),
    where('school', 'in', [HELENE]),
  )));
  await assertFails(getDocs(query(
    collection(adminDb, 'users'),
    where('role', '==', 'faculty'),
    where('school', 'in', [SECOND]),
  )));
  await assertSucceeds(setDoc(doc(superDb, 'users/faculty-super'), {
    role: 'faculty',
    status: 'approved',
    email: 'super-faculty@example.com',
    school: SECOND,
  }));
  await assertFails(setDoc(doc(superDb, 'users/faculty-blank'), {
    role: 'faculty',
    status: 'approved',
    email: 'blank@example.com',
  }));
  await assertFails(setDoc(doc(superDb, 'users/faculty-list'), {
    role: 'faculty',
    status: 'approved',
    email: 'list@example.com',
    school: HELENE,
    schools: [HELENE],
  }));
});

test('creatorSchool cannot be taken from the card, and a tester with no school cannot create', async () => {
  await seed([
    ['users/tester-blank', approved('tester', 'blank@example.com')],
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['users/admin-1', scopedAdmin([HELENE, SECOND])],
    ['users/admin-second', scopedAdmin([SECOND], 'second@example.com')],
  ]);
  const blankDb = testEnv.authenticatedContext('tester-blank').firestore();
  const testerDb = testEnv.authenticatedContext('tester-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const secondDb = testEnv.authenticatedContext('admin-second').firestore();

  await assertFails(setDoc(doc(blankDb, 'fitTests/forged'), {
    userId: 'tester-blank',
    schoolsList: HELENE,
    creatorRole: 'tester',
    creatorSchool: HELENE,
  }));
  await assertFails(setDoc(doc(testerDb, 'fitTests/card-school'), {
    userId: 'tester-1',
    schoolsList: SECOND,
    creatorRole: 'tester',
    creatorSchool: SECOND,
  }));
  await assertSucceeds(setDoc(doc(testerDb, 'fitTests/own-school'), {
    userId: 'tester-1',
    schoolsList: SECOND,
    creatorRole: 'tester',
    creatorSchool: HELENE,
    ...respiratorRecord(),
  }));
  await assertSucceeds(setDoc(doc(adminDb, 'fitTests/admin-second'), {
    userId: 'admin-1',
    schoolsList: HELENE,
    creatorRole: 'admin',
    creatorSchool: SECOND,
    ...respiratorRecord(),
  }));
  await assertFails(setDoc(doc(secondDb, 'fitTests/not-mine'), {
    userId: 'admin-second',
    schoolsList: HELENE,
    creatorRole: 'admin',
    creatorSchool: HELENE,
  }));
});

test('faculty have one school, and a schools list does not widen what they can read', async () => {
  await seed([
    ['users/super-1', approved('superadmin', 'sam@example.com')],
    ['users/admin-1', scopedAdmin([HELENE, SECOND])],
    ['users/faculty-both', approved('faculty', 'both@example.com', {
      school: HELENE,
      schools: [SECOND],
    })],
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['fitTests/helene', {
      userId: 'tester-1',
      creatorRole: 'tester',
      creatorSchool: HELENE,
    }],
    ['fitTests/second', {
      userId: 'tester-1',
      creatorRole: 'tester',
      creatorSchool: SECOND,
    }],
  ]);
  const superDb = testEnv.authenticatedContext('super-1').firestore();
  const facultyDb = testEnv.authenticatedContext('faculty-both').firestore();

  await assertFails(updateDoc(doc(superDb, 'users/admin-1'), {
    role: 'faculty',
    school: HELENE,
  }));
  await assertSucceeds(updateDoc(doc(superDb, 'users/admin-1'), {
    role: 'faculty',
    school: HELENE,
    schools: deleteField(),
  }));
  await assertSucceeds(getDoc(doc(facultyDb, 'fitTests/helene')));
  await assertFails(getDoc(doc(facultyDb, 'fitTests/second')));
  await assertFails(getDocs(query(
    collection(facultyDb, 'fitTests'),
    where('creatorSchool', '==', SECOND),
    orderBy('createdAt', 'desc'),
    limit(100),
  )));
});

test('faculty outside the access window cannot read results', async () => {
  const past = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
  const future = Timestamp.fromDate(new Date('2099-01-01T00:00:00Z'));
  await seed([
    ['users/faculty-expired', approved('faculty', 'expired@example.com', {
      school: HELENE,
      endDate: past,
    })],
    ['users/faculty-future', approved('faculty', 'future@example.com', {
      school: HELENE,
      startDate: future,
    })],
    ['users/faculty-open', approved('faculty', 'open@example.com', {
      school: HELENE,
      startDate: past,
      endDate: future,
    })],
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['fitTests/stamped', {
      userId: 'tester-1',
      creatorRole: 'tester',
      creatorSchool: HELENE,
    }],
    ['fitTests/owned-by-expired', {
      userId: 'faculty-expired',
      creatorRole: 'tester',
      creatorSchool: HELENE,
    }],
  ]);
  const expiredDb = testEnv.authenticatedContext('faculty-expired').firestore();
  const futureDb = testEnv.authenticatedContext('faculty-future').firestore();
  const openDb = testEnv.authenticatedContext('faculty-open').firestore();

  await assertFails(getDoc(doc(expiredDb, 'fitTests/stamped')));
  await assertFails(getDoc(doc(expiredDb, 'fitTests/owned-by-expired')));
  await assertFails(getDocs(query(
    collection(expiredDb, 'fitTests'),
    where('creatorSchool', '==', HELENE),
    orderBy('createdAt', 'desc'),
    limit(100),
  )));
  await assertFails(getDoc(doc(futureDb, 'fitTests/stamped')));
  await assertFails(setDoc(doc(expiredDb, 'fitTests/new'), {
    userId: 'faculty-expired',
    schoolsList: HELENE,
    creatorRole: 'faculty',
    creatorSchool: HELENE,
  }));
  await assertSucceeds(getDoc(doc(openDb, 'fitTests/stamped')));
});

test('lookup and verification copies match the fit test and stay inside the admin school', async () => {
  const token = 'a'.repeat(32);
  const parent = {
    userId: 'tester-1',
    schoolsList: HELENE,
    lookupKey: 'lookup-1',
    verificationToken: token,
    clientName: 'Ada',
    result: 'Pass',
    ...respiratorRecord(),
  };
  const lookup = {
    recipientEmail: '',
    clientName: 'Ada',
    dob: '',
    testLocation: '',
    issueDate: '',
    expirationDate: '',
    fitTestType: '',
    testingAgent: '',
    fitFactor: '',
    result: 'Pass',
    fitTester: '',
    verificationToken: token,
    userId: 'tester-1',
    fitTestId: 'own-1',
    lookupKey: 'lookup-1',
    ...respiratorRecord(),
  };
  const verification = {
    clientName: 'Ada',
    testLocation: '',
    issueDate: '',
    expirationDate: '',
    fitTestType: '',
    fitFactor: '',
    result: 'Pass',
    fitTester: '',
    userId: 'tester-1',
    fitTestId: 'own-1',
    verificationToken: token,
    ...respiratorRecord(),
  };
  await seed([
    ['users/tester-1', approved('tester', 'tester@example.com', { school: HELENE })],
    ['users/tester-2', approved('tester', 'other@example.com', { school: HELENE })],
    ['users/admin-1', scopedAdmin([HELENE])],
    ['users/admin-2', scopedAdmin([SECOND], 'other-admin@example.com')],
    ['fitTests/own-1', parent],
  ]);
  const ownerDb = testEnv.authenticatedContext('tester-1').firestore();
  const otherDb = testEnv.authenticatedContext('tester-2').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  const outsideDb = testEnv.authenticatedContext('admin-2').firestore();

  await assertSucceeds(setDoc(doc(ownerDb, 'fitTestLookups/lookup-1'), lookup));
  await assertSucceeds(setDoc(doc(adminDb, `fitTestVerifications/${token}`), verification));
  await assertFails(setDoc(doc(outsideDb, 'fitTestLookups/lookup-1'), lookup));
  await assertFails(setDoc(doc(otherDb, `fitTestVerifications/${token}`), verification));
  await assertFails(setDoc(doc(adminDb, `fitTestVerifications/${token}`), {
    ...verification,
    result: 'Fail',
  }));
  await assertFails(setDoc(doc(ownerDb, 'fitTestLookups/lookup-1'), {
    ...lookup,
    revokedAt: Timestamp.now(),
  }));
  await assertSucceeds(updateDoc(doc(adminDb, 'fitTestLookups/lookup-1'), {
    revokedAt: Timestamp.now(),
  }));
  await assertFails(updateDoc(doc(adminDb, 'fitTestLookups/lookup-1'), {
    revokedAt: deleteField(),
  }));
  await assertFails(updateDoc(doc(adminDb, `fitTestVerifications/${token}`), {
    userId: 'admin-1',
  }));
});
