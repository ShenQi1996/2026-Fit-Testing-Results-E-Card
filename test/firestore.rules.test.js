import fs from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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

test('an admin with no status can set status approved on their own doc', async () => {
  await seed([[
    'users/SX26kFfwDRM7OR4xVFECwg5QulG2',
    { role: 'admin', email: 'qisam1989@gmail.com', name: 'Sam' },
  ]]);
  const db = testEnv.authenticatedContext('SX26kFfwDRM7OR4xVFECwg5QulG2').firestore();

  await assertSucceeds(updateDoc(doc(db, 'users/SX26kFfwDRM7OR4xVFECwg5QulG2'), {
    status: 'approved',
  }));
});
