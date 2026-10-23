import fs from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const RULES = fs.readFileSync('firestore.rules', 'utf8');

let testEnv;

const seed = async (writes) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of writes) {
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

const approved = (role, email) => ({ role, status: 'approved', email });

test('a regular admin can approve a tester', async () => {
  await seed([
    ['users/admin-1', approved('admin', 'admin@example.com')],
    ['users/tester-1', { role: 'tester', status: 'pending', email: 'tester@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/tester-1'), { status: 'approved' }));
});

test('a regular admin cannot grant admin', async () => {
  await seed([
    ['users/admin-1', approved('admin', 'admin@example.com')],
    ['users/tester-1', { role: 'tester', status: 'pending', email: 'tester@example.com' }],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/tester-1'), { role: 'admin' }));
});

test('a regular admin cannot update an admin or super admin doc', async () => {
  await seed([
    ['users/admin-1', approved('admin', 'admin@example.com')],
    ['users/admin-2', approved('admin', 'other@example.com')],
    ['users/super-1', approved('superadmin', 'sam@example.com')],
  ]);
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(updateDoc(doc(db, 'users/admin-2'), { name: 'Renamed' }));
  await assertFails(updateDoc(doc(db, 'users/super-1'), { name: 'Renamed' }));
});

test('a regular admin cannot create an admin profile', async () => {
  await seed([
    ['users/admin-1', approved('admin', 'admin@example.com')],
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
    ['users/admin-1', approved('admin', 'admin@example.com')],
    ['users/tester-1', { role: 'tester', status: 'pending', email: 'tester@example.com' }],
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
    ['users/admin-1', approved('admin', 'admin@example.com')],
    ['users/tester-1', { role: 'tester', status: 'approved', email: 'tester@example.com' }],
    ['users/admin-2', approved('admin', 'other@example.com')],
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
    ['users/admin-1', approved('admin', 'admin@example.com')],
    ['users/tester-1', { role: 'tester', status: 'pending', email: 'tester@example.com', name: 'Tester' }],
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
