import fs from 'fs';
import { buildLookupKey } from '../utils/lookupKey';
import {
  PROD_PROJECT_ID,
  STAGING_PROJECT_ID,
  assertAllowedProject,
  buildSeedPlan,
  parseArgs,
} from '../../scripts/seed-staging';

const plan = buildSeedPlan();
const byPath = Object.fromEntries(plan.documents.map((entry) => [entry.path, entry.data]));
const fitById = Object.fromEntries(plan.fitTests.map((entry) => [entry.path.split('/')[1], entry.data]));

test('the seed refuses every project except staging, including production', () => {
  expect(() => assertAllowedProject(PROD_PROJECT_ID)).toThrow(
    /Refusing to seed production project fit-test-result-e-card-2026/
  );
  expect(() => assertAllowedProject('fit-test-result-e-card-staging ')).toThrow(/Refusing to seed project/);
  expect(() => assertAllowedProject('')).toThrow(/Refusing to seed project/);
  expect(() => assertAllowedProject('some-other-project')).toThrow(/Refusing to seed project/);
  expect(assertAllowedProject(STAGING_PROJECT_ID)).toBe('fit-test-result-e-card-staging');
});

test('seed source only set()s documents and takes the password from the environment', () => {
  const source = fs.readFileSync('scripts/seed-staging.js', 'utf8');
  expect(source).toContain('GOOGLE_APPLICATION_CREDENTIALS');
  expect(source).toContain('writer.set(');
  expect(source).not.toMatch(/\.delete\(/);
  expect(source).not.toMatch(/deleteUser/);
  expect(source).not.toMatch(/SEED_PASSWORD\s*=\s*['"]/);
  expect(source).not.toMatch(/password\s*[:=]\s*['"][^'"]+['"]/);
});

test('parseArgs accepts only the dry-run and auth flags', () => {
  expect(parseArgs(['node', 'seed', '--dry-run'])).toEqual({ dryRun: true, withAuth: false });
  expect(parseArgs(['node', 'seed', '--with-auth'])).toEqual({ dryRun: false, withAuth: true });
  expect(() => parseArgs(['node', 'seed', '--reset'])).toThrow(/Unknown argument/);
});

test('users, profiles, and fit tests use fixed fake ids and example.com addresses', () => {
  expect(byPath['users/seed-user-superadmin']).toMatchObject({
    name: 'Test Person 01',
    email: 'test-person-01@example.com',
    role: 'superadmin',
    status: 'approved',
    provider: 'google.com',
    approvedBy: 'seed-user-superadmin',
  });
  expect(byPath['users/seed-user-admin']).toMatchObject({
    role: 'admin',
    status: 'approved',
    provider: 'password',
  });
  expect(byPath['users/seed-user-tester']).toMatchObject({
    role: 'tester',
    status: 'approved',
  });
  expect(byPath['users/seed-user-pending']).toMatchObject({
    name: 'Test Person 04',
    email: 'test-person-04@example.com',
    role: 'tester',
    status: 'pending',
  });
  expect(byPath['users/seed-user-pending'].approvedAt).toBeUndefined();
  expect(byPath['users/seed-user-pending'].approvedBy).toBeUndefined();

  const googleProviders = plan.users.filter((entry) => entry.data.provider === 'google.com');
  expect(googleProviders).toHaveLength(1);

  expect(byPath['users/seed-user-tester/schoolProfiles/seed-school-01']).toBeUndefined();
  expect(byPath['users/seed-user-tester/solutionProfiles/seed-solution-02']).toMatchObject({
    solutionType: 'Saccharin',
    isDefault: false,
    orderIndex: 1,
  });

  const serialized = JSON.stringify(plan);
  expect(serialized).not.toContain(PROD_PROJECT_ID);
  expect(serialized).not.toMatch(/@(?!example\.com)/);
  expect(serialized).not.toMatch(/gmail\.com/);
});

test('fit tests cover three generations, a failure, and the lookup and verify docs', async () => {
  expect(Object.keys(fitById.seedftlegacy00000001)).toHaveLength(18);
  expect(fitById.seedftlegacy00000001.expirationDate).toBeUndefined();
  expect(fitById.seedftlegacy00000001.testLocation).toBeUndefined();
  expect(fitById.seedftlegacy00000001.fitTestType).toBe('N95');
  expect(fitById.seedftlegacy00000001.result).toBe('Pass');
  expect(fitById.seedftlegacy00000001.fitTester).toBe('Test Person 03');
  expect(fitById.seedftlegacy00000001.userId).toBe('seed-user-tester');
  expect(fitById.seedftlegacy00000001.signatureDataUrl.startsWith('data:')).toBe(true);

  expect(Object.keys(fitById.seedftfull0000000001)).toHaveLength(50);
  expect(fitById.seedftfull0000000001.fitTestMethod).toBe('Locked to Qualitative');
  expect(fitById.seedftfull0000000001.testerAttestationMedicalClearanceVerified).toBe(true);
  expect(fitById.seedftfull0000000001.consentToFitTest).toBeUndefined();
  expect(fitById.seedftfull0000000001.testLocation).toBe('Harlem');

  expect(Object.keys(fitById.seedftnoloc000000001)).toHaveLength(49);
  expect(fitById.seedftnoloc000000001.testLocation).toBeUndefined();
  expect(fitById.seedftnoloc000000001.respiratorMfg).toBe('Makrite sekura');
  expect(fitById.seedftnoloc000000001.expirationDate).toBe('08/20/2026');

  expect(Object.keys(fitById.seedftnewest00000001)).toHaveLength(58);
  expect(fitById.seedftnewest00000001.testerAttestationConsentWitnessed).toBe(true);
  expect(fitById.seedftnewest00000001.testerAttestationMedicalClearanceVerified).toBeUndefined();
  expect(fitById.seedftnewest00000001.testLocation).toBe('Brooklyn');
  expect(fitById.seedftnewest00000001.consentToFitTest).toBe(true);
  expect(fitById.seedftnewest00000001.maskSize).toBe('Regular');

  expect(fitById.seedftfail0000000001.result).toBe('Fail');
  expect(fitById.seedftfail0000000001.failureReason).toBe('Taste detected');
  expect(fitById.seedftfail0000000001.maskSize).toBe('Small');

  Object.keys(fitById).forEach((id) => {
    expect(id).toHaveLength(20);
  });

  for (const [id, fitTest] of Object.entries(fitById)) {
    const appKey = await buildLookupKey(fitTest.clientName, fitTest.dob, fitTest.recipientEmail);
    expect(fitTest.lookupKey).toBe(appKey);
    expect(fitTest.lookupKey).toMatch(/^[a-f0-9]{64}$/);
    expect(fitTest.verificationToken).toMatch(/^[a-f0-9]{32}$/);

    const lookup = byPath[`fitTestLookups/${fitTest.lookupKey}`];
    const verification = byPath[`fitTestVerifications/${fitTest.verificationToken}`];
    expect(lookup.fitTestId).toBe(id);
    expect(lookup.clientName).toBe(fitTest.clientName);
    expect(lookup.recipientEmail).toBe(fitTest.recipientEmail);
    expect(verification.fitTestId).toBe(id);
    expect(verification.clientName).toBe(fitTest.clientName);
    expect(verification.result).toBe(fitTest.result);
    expect(verification.fitTester).toBe(fitTest.fitTester);
    expect(Object.keys(verification)).toHaveLength(14);
    expect(verification.dob).toBeUndefined();
    expect(verification.recipientEmail).toBeUndefined();
    expect(verification.printedName).toBeUndefined();
    expect(verification.signatureDataUrl).toBeUndefined();
  }

  const legacyLookup = byPath[`fitTestLookups/${fitById.seedftlegacy00000001.lookupKey}`];
  expect(legacyLookup.testCreatedAtMs).toBeUndefined();
  expect(legacyLookup.verificationToken).toBeUndefined();
  expect(legacyLookup.expirationDate).toBeUndefined();

  const newestLookup = byPath[`fitTestLookups/${fitById.seedftnewest00000001.lookupKey}`];
  expect(Number.isInteger(newestLookup.testCreatedAtMs)).toBe(true);
  expect(newestLookup.verificationToken).toBe(fitById.seedftnewest00000001.verificationToken);
  expect(newestLookup.testLocation).toBe('Brooklyn');

  const legacyVerification = byPath[
    `fitTestVerifications/${fitById.seedftlegacy00000001.verificationToken}`
  ];
  expect(legacyVerification.expirationDate).toBe('03/01/2025');
  expect(legacyVerification.testLocation).toBe('');

  const noLocationLookup = byPath[`fitTestLookups/${fitById.seedftnoloc000000001.lookupKey}`];
  expect(noLocationLookup.testLocation).toBeUndefined();
  expect(noLocationLookup.expirationDate).toBe('08/20/2026');
});
