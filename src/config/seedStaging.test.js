import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  PROD_PROJECT_ID,
  assertStagingProject,
  buildStagingSeed,
  readServiceAccount,
} from '../../scripts/seed-staging';

const uids = {
  superadmin: 'uid-super',
  admin: 'uid-admin',
  tester: 'uid-tester',
  pending: 'uid-pending',
};

test('the seed refuses the production project id', () => {
  expect(() => assertStagingProject(PROD_PROJECT_ID)).toThrow(/Refusing to seed production project/);
  expect(() => assertStagingProject('  fit-test-result-e-card-2026  ')).toThrow(/Refusing to seed/);
  expect(() => assertStagingProject('')).toThrow(/missing/i);
  expect(assertStagingProject('fit-test-result-e-card-staging')).toBe('fit-test-result-e-card-staging');
});

test('readServiceAccount rejects a key for the production project', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-staging-'));
  const prodKey = path.join(dir, 'prod.json');
  const stagingKey = path.join(dir, 'staging.json');
  const account = {
    client_email: 'seed@example.iam.gserviceaccount.com',
    private_key: 'not-a-real-key',
    project_id: PROD_PROJECT_ID,
  };
  fs.writeFileSync(prodKey, JSON.stringify(account));
  fs.writeFileSync(stagingKey, JSON.stringify({
    ...account,
    project_id: 'fit-test-result-e-card-staging',
  }));

  expect(() => readServiceAccount('')).toThrow(/FIREBASE_SERVICE_ACCOUNT_PATH/);
  expect(() => readServiceAccount(prodKey)).toThrow(/Refusing to seed production project/);
  expect(readServiceAccount(stagingKey).project_id).toBe('fit-test-result-e-card-staging');
});

test('staging seed documents match the app schema and use fake people', () => {
  const seed = buildStagingSeed(uids);
  const byRole = Object.fromEntries(seed.users.map((entry) => [entry.data.email, entry.data]));

  expect(byRole['staging-superadmin@example.com']).toMatchObject({
    role: 'superadmin',
    status: 'approved',
    approvedBy: 'uid-super',
  });
  expect(byRole['staging-admin@example.com']).toMatchObject({
    role: 'admin',
    status: 'approved',
  });
  expect(byRole['staging-tester@example.com']).toMatchObject({
    role: 'tester',
    status: 'approved',
  });
  expect(byRole['staging-pending@example.com']).toMatchObject({
    role: 'tester',
    status: 'pending',
  });
  expect(byRole['staging-pending@example.com'].approvedAt).toBeUndefined();

  const fitTest = seed.fitTests[0];
  expect(fitTest.id).toBe('staging-fake-fit-test');
  expect(fitTest.data.userId).toBe('uid-tester');
  expect(fitTest.data.fitTester).toBe('Staging Tester');
  expect(fitTest.data.recipientEmail).toBe('fake-client@example.com');
  expect(seed.fitTestLookups).toHaveLength(1);
  expect(seed.fitTestLookups[0].id).toBe(fitTest.data.lookupKey);
  expect(seed.fitTestLookups[0].data.fitTestId).toBe(fitTest.id);
  expect(seed.fitTestVerifications[0].id).toMatch(/^[a-f0-9]{32}$/);
  expect(seed.fitTestVerifications[0].data.fitTester).toBe('Staging Tester');
  expect(JSON.stringify(seed)).not.toContain(PROD_PROJECT_ID);
});
