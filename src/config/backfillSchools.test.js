import fs from 'fs';
import os from 'os';
import path from 'path';
import { SCHOOLS_OPTIONS, TEST_LOCATION_OPTIONS } from '../constants/fitTestOptions';
import { buildSeedPlan } from '../../scripts/seed-staging';
import {
  KNOWN_SCHOOL,
  PROD_PROJECT_ID,
  SKIP_REASONS,
  STAGING_PROJECT_ID,
  applySchoolUpdates,
  assertAllowedProject,
  formatSchoolBackfillReport,
  formatWriteResult,
  loadCredentials,
  parseArgs,
  planSchoolBackfill,
  projectIdFromApp,
  readTesters,
  schoolFieldUpdate,
} from '../../scripts/backfill-schools';

const tester = (id, user, records) => ({ id, user: { role: 'tester', ...user }, records });

const withCredentialEnv = (env, fn) => {
  const previousCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const previousProject = process.env.FIREBASE_PROJECT_ID;
  if (env.credentials === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  else process.env.GOOGLE_APPLICATION_CREDENTIALS = env.credentials;
  if (env.projectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
  else process.env.FIREBASE_PROJECT_ID = env.projectId;
  try {
    return fn();
  } finally {
    if (previousCredentials === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentials;
    if (previousProject === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = previousProject;
  }
};

const writeServiceAccount = (projectId, extra = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-schools-'));
  const filePath = path.join(dir, 'service-account.json');
  fs.writeFileSync(filePath, JSON.stringify({
    client_email: 'backfill@fit-test-result-e-card-staging.iam.gserviceaccount.com',
    private_key: 'not-a-real-key',
    project_id: projectId,
    ...extra,
  }));
  return filePath;
};

test('the only known school is Helene College of Nursing', () => {
  expect(SCHOOLS_OPTIONS.map((option) => option.value)).toEqual([KNOWN_SCHOOL]);
  expect(TEST_LOCATION_OPTIONS.map((option) => option.value)).toEqual([
    'Harlem',
    'Brooklyn',
    'Other',
  ]);
});

test('the project guard refuses every project except staging, including production', () => {
  expect(() => assertAllowedProject(PROD_PROJECT_ID)).toThrow(
    /Refusing to backfill production project fit-test-result-e-card-2026/
  );
  expect(() => assertAllowedProject('fit-test-result-e-card-staging ')).toThrow(
    /Refusing to backfill project/
  );
  expect(() => assertAllowedProject('')).toThrow(/Refusing to backfill project ""/);
  expect(() => assertAllowedProject('some-other-project')).toThrow(
    /Refusing to backfill project "some-other-project"/
  );
  expect(assertAllowedProject(STAGING_PROJECT_ID)).toBe('fit-test-result-e-card-staging');
});

test('production is refused before credentials are read and again after connect', () => {
  expect(() => withCredentialEnv({
    credentials: '/no/such/staging-service-account.json',
    projectId: PROD_PROJECT_ID,
  }, () => loadCredentials())).toThrow(/production project fit-test-result-e-card-2026/);

  const stagingFile = writeServiceAccount(STAGING_PROJECT_ID);
  expect(() => withCredentialEnv({
    credentials: stagingFile,
    projectId: 'some-other-project',
  }, () => loadCredentials())).toThrow(/Refusing to backfill project "some-other-project"/);

  const prodFile = writeServiceAccount(PROD_PROJECT_ID);
  expect(() => withCredentialEnv({
    credentials: prodFile,
  }, () => loadCredentials())).toThrow(/production project fit-test-result-e-card-2026/);

  const loaded = withCredentialEnv({
    credentials: stagingFile,
    projectId: STAGING_PROJECT_ID,
  }, () => loadCredentials());
  expect(loaded.project_id).toBe(STAGING_PROJECT_ID);
  expect(loaded.private_key).toBe('not-a-real-key');

  expect(() => assertAllowedProject(projectIdFromApp({
    options: { projectId: PROD_PROJECT_ID },
  }))).toThrow(/production project fit-test-result-e-card-2026/);
  expect(() => assertAllowedProject(projectIdFromApp({ options: {} }))).toThrow(
    /Refusing to backfill project ""/
  );
  expect(assertAllowedProject(projectIdFromApp({
    options: { projectId: STAGING_PROJECT_ID },
  }))).toBe(STAGING_PROJECT_ID);
});

test('credential loading stays on the staging service account file', () => {
  expect(() => withCredentialEnv({}, () => loadCredentials())).toThrow(
    /GOOGLE_APPLICATION_CREDENTIALS/
  );

  const incomplete = writeServiceAccount(STAGING_PROJECT_ID, { private_key: '' });
  expect(() => withCredentialEnv({
    credentials: incomplete,
  }, () => loadCredentials())).toThrow(/client_email, private_key, or project_id/);

  const source = fs.readFileSync('scripts/backfill-schools.js', 'utf8');
  const credentialsSource = source.slice(
    source.indexOf('const loadCredentials'),
    source.indexOf('const parseArgs')
  );
  const connectSource = source.slice(source.indexOf('const backfillSchools'));
  expect(credentialsSource).toContain('GOOGLE_APPLICATION_CREDENTIALS');
  expect(credentialsSource).toContain(
    'assertAllowedProject(String(process.env.FIREBASE_PROJECT_ID).trim())'
  );
  expect(credentialsSource).toContain('assertAllowedProject(parsed.project_id)');
  expect(credentialsSource).not.toContain('initializeApp');
  expect(connectSource.indexOf('loadCredentials()')).toBeGreaterThan(-1);
  expect(connectSource.indexOf('admin.initializeApp(')).toBeGreaterThan(
    connectSource.indexOf('loadCredentials()')
  );
  expect(connectSource.indexOf('assertAllowedProject(projectIdFromApp(admin.app()))')).toBeGreaterThan(
    connectSource.indexOf('admin.initializeApp(')
  );
  expect(source).not.toMatch(/\.delete\(/);
  expect(source).toContain('.update(payloadOnlySchool(update.payload))');
  const readSource = source.slice(
    source.indexOf('const readTesters'),
    source.indexOf('const applySchoolUpdates')
  );
  expect(readSource).toContain("where('role', '==', 'tester')");
  expect(readSource).toContain("where('userId', '==', userDoc.id)");
  expect(readSource).not.toContain('schoolProfiles');
  expect(readSource).not.toContain('testLocation');
});

test('parseArgs keeps dry run as the default', () => {
  expect(parseArgs(['node', 'backfill-schools.js'])).toEqual({ write: false });
  expect(parseArgs(['node', 'backfill-schools.js', '--write'])).toEqual({ write: true });
  expect(() => parseArgs(['node', 'backfill-schools.js', '--dry-run'])).toThrow(
    /Dry run is the default/
  );
  expect(() => parseArgs(['node', 'backfill-schools.js', '--reset'])).toThrow(/Unknown argument/);
});

test('resolves a school from schoolsList or schoolName on fit test records', () => {
  const fromList = planSchoolBackfill([
    tester('from-list', { email: 'list@example.com', name: 'List Tester' }, [
      { schoolsList: `  ${KNOWN_SCHOOL}  `, testLocation: 'Harlem', schoolsOnFile: true },
      { schoolsList: '', testLocation: 'Brooklyn' },
    ]),
  ]);
  expect(fromList.updates).toEqual([{
    uid: 'from-list',
    email: 'list@example.com',
    name: 'List Tester',
    school: KNOWN_SCHOOL,
  }]);
  expect(fromList.schoolValues).toEqual([{ value: KNOWN_SCHOOL, count: 1 }]);
  expect(schoolFieldUpdate(fromList.updates[0].school)).toEqual({ school: KNOWN_SCHOOL });

  const fromName = planSchoolBackfill([
    tester('from-name', {}, [
      { schoolName: KNOWN_SCHOOL, schoolsList: KNOWN_SCHOOL },
    ]),
  ]);
  expect(fromName.updates).toEqual([{
    uid: 'from-name',
    email: '',
    name: '',
    school: KNOWN_SCHOOL,
  }]);
  expect(fromName.schoolValues).toEqual([{ value: KNOWN_SCHOOL, count: 1 }]);

  const blankSchool = planSchoolBackfill([
    tester('blank', { school: '   ' }, [{ schoolsList: KNOWN_SCHOOL }]),
    tester('missing', {}, [{ schoolName: KNOWN_SCHOOL }]),
    tester('null-school', { school: null }, [{ schoolsList: KNOWN_SCHOOL }]),
  ]);
  expect(blankSchool.updates.map((update) => update.uid)).toEqual(['blank', 'missing', 'null-school']);
  expect(blankSchool.schoolValues).toEqual([{ value: KNOWN_SCHOOL, count: 3 }]);
});

test('testLocation is never used as a school', () => {
  TEST_LOCATION_OPTIONS.forEach((option) => {
    const plan = planSchoolBackfill([
      tester(`loc-${option.value}`, {}, [{
        testLocation: option.value,
        schoolsOnFile: true,
        schoolsList: '   ',
        schoolName: '',
      }]),
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.schoolValues).toEqual([]);
    expect(plan.skips).toEqual([expect.objectContaining({
      uid: `loc-${option.value}`,
      reason: SKIP_REASONS.NO_SCHOOL_ON_RECORDS,
    })]);
  });

  const storedOnSchoolField = planSchoolBackfill([
    tester('location-as-text', { email: 'loc@example.com' }, [{
      schoolsList: 'Harlem',
      testLocation: 'Brooklyn',
    }]),
  ]);
  expect(storedOnSchoolField.updates).toEqual([]);
  expect(storedOnSchoolField.schoolValues).toEqual([{ value: 'Harlem', count: 1 }]);
  expect(storedOnSchoolField.skips[0].reason).toBe(SKIP_REASONS.UNRECOGNIZED);
});

test('unrecognized school values are reported and skipped', () => {
  const plan = planSchoolBackfill([
    tester('example', { email: 'seed@example.com' }, [
      { schoolsList: 'Example Training School' },
      { schoolsList: 'Example Training School', testLocation: 'Harlem' },
    ]),
    tester('second', {}, [{ schoolName: 'Example Second School' }]),
    tester('spaced', {}, [{ schoolsList: 'Helene  College of Nursing' }]),
    tester('lower', {}, [{ schoolsList: 'helene college of nursing' }]),
  ]);

  expect(plan.updates).toEqual([]);
  expect(plan.skips.map((skip) => [skip.uid, skip.reason, skip.schools])).toEqual([
    ['example', SKIP_REASONS.UNRECOGNIZED, ['Example Training School']],
    ['lower', SKIP_REASONS.UNRECOGNIZED, ['helene college of nursing']],
    ['second', SKIP_REASONS.UNRECOGNIZED, ['Example Second School']],
    ['spaced', SKIP_REASONS.UNRECOGNIZED, ['Helene  College of Nursing']],
  ]);
  expect(plan.schoolValues).toEqual([
    { value: 'Example Training School', count: 2 },
    { value: 'Example Second School', count: 1 },
    { value: 'Helene  College of Nursing', count: 1 },
    { value: 'helene college of nursing', count: 1 },
  ]);
});

test('conflicting schools across records are reported and skipped', () => {
  const plan = planSchoolBackfill([
    tester('across', { email: 'mix@example.com', name: 'Mix' }, [
      { schoolsList: KNOWN_SCHOOL, testLocation: 'Harlem' },
      { schoolsList: 'Example Training School', testLocation: 'Brooklyn' },
      { testLocation: 'Other' },
    ]),
    tester('same-record', {}, [{
      schoolsList: KNOWN_SCHOOL,
      schoolName: 'Example Second School',
    }]),
  ]);

  expect(plan.updates).toEqual([]);
  expect(plan.skips).toEqual([
    expect.objectContaining({
      uid: 'across',
      reason: SKIP_REASONS.CONFLICT,
      schools: ['Example Training School', KNOWN_SCHOOL],
    }),
    expect.objectContaining({
      uid: 'same-record',
      reason: SKIP_REASONS.CONFLICT,
      schools: ['Example Second School', KNOWN_SCHOOL],
    }),
  ]);
  expect(plan.schoolValues).toEqual([
    { value: KNOWN_SCHOOL, count: 2 },
    { value: 'Example Second School', count: 1 },
    { value: 'Example Training School', count: 1 },
  ]);
});

test('skips testers with no records, an existing school, or a role other than tester', () => {
  const plan = planSchoolBackfill([
    tester('empty', { email: 'empty@example.com' }, []),
    { id: 'none', user: { role: 'tester', name: 'No Records' } },
    tester('kept', {
      email: 'kept@example.com',
      school: 'Example Training School',
    }, [
      { schoolsList: KNOWN_SCHOOL },
      { schoolsList: 'Somewhere Else' },
    ]),
    {
      id: 'admin',
      user: { role: 'admin', email: 'admin@example.com' },
      records: [{ schoolsList: KNOWN_SCHOOL }],
    },
  ]);

  expect(plan.updates).toEqual([]);
  expect(plan.schoolValues).toEqual([]);
  expect(plan.skips.map((skip) => [skip.uid, skip.reason])).toEqual([
    ['admin', SKIP_REASONS.NOT_TESTER],
    ['empty', SKIP_REASONS.NO_RECORDS],
    ['kept', SKIP_REASONS.ALREADY_HAS_SCHOOL],
    ['none', SKIP_REASONS.NO_RECORDS],
  ]);
  expect(plan.skips.find((skip) => skip.uid === 'kept').school).toBe('Example Training School');
});

test('seeded fit tests use Example Training School, which this backfill will not write', () => {
  const seed = buildSeedPlan();
  const records = seed.fitTests
    .filter((entry) => entry.data.userId === 'seed-user-tester')
    .map((entry) => entry.data);
  const plan = planSchoolBackfill([
    tester('seed-user-tester', { email: 'test-person-03@example.com' }, records),
  ]);

  expect(records.some((record) => record.schoolsList === 'Example Training School')).toBe(true);
  expect(records.some((record) => record.testLocation === 'Harlem')).toBe(true);
  expect(plan.updates).toEqual([]);
  expect(plan.schoolValues).toEqual([{ value: 'Example Training School', count: 4 }]);
  expect(plan.skips[0]).toMatchObject({
    uid: 'seed-user-tester',
    reason: SKIP_REASONS.UNRECOGNIZED,
    schools: ['Example Training School'],
  });

  const profileSchools = seed.profiles
    .filter((entry) => entry.path.includes('/schoolProfiles/'))
    .map((entry) => entry.data.schoolName)
    .sort();
  expect(profileSchools).toEqual([]);
});

test('the report lists school values, planned updates, and skips, and dry run writes nothing', () => {
  const plan = planSchoolBackfill([
    tester('ready', { email: 'ready@example.com' }, [
      { schoolsList: KNOWN_SCHOOL },
      { schoolsList: KNOWN_SCHOOL },
    ]),
    tester('unknown', {}, [{ schoolsList: 'Example Training School' }]),
    tester('empty', {}, []),
  ]);
  const dryRun = formatSchoolBackfillReport(plan, {
    write: false,
    projectId: STAGING_PROJECT_ID,
  });

  expect(dryRun).toContain('Dry run only. No documents were written.');
  expect(dryRun).toContain('Project: fit-test-result-e-card-staging');
  expect(dryRun).toContain(
    'School values found on fit tests for testers with no school (occurrences):'
  );
  expect(dryRun).toContain(`  2  ${KNOWN_SCHOOL}`);
  expect(dryRun).toContain('  1  Example Training School');
  expect(dryRun).toContain('Planned updates:');
  expect(dryRun).toContain(`users/ready  ready@example.com  school="${KNOWN_SCHOOL}"`);
  expect(dryRun).toContain('Skipped:');
  expect(dryRun).toContain('users/unknown  unrecognized school: Example Training School');
  expect(dryRun).toContain('users/empty  no fit test records');
  expect(dryRun).not.toContain('Wrote users/');

  const writeReport = formatSchoolBackfillReport(plan, {
    write: true,
    projectId: STAGING_PROJECT_ID,
  });
  expect(writeReport.startsWith('Write mode.')).toBe(true);
  expect(writeReport).not.toContain('No documents were written.');
  expect(formatWriteResult({
    written: [{ uid: 'ready', school: KNOWN_SCHOOL }],
  })).toBe([
    `Wrote users/ready school="${KNOWN_SCHOOL}"`,
    'Wrote school on 1 user document(s).',
  ].join('\n'));
});

test('fitTests are read only for testers with no school, and writes set school alone', async () => {
  const fitTestReads = [];
  const userWrites = [];
  const db = {
    collection(name) {
      return {
        where(field, op, value) {
          return {
            get: async () => {
              if (name === 'users') {
                expect({ field, op, value }).toEqual({ field: 'role', op: '==', value: 'tester' });
                return {
                  docs: [
                    {
                      id: 'already',
                      data: () => ({ role: 'tester', school: KNOWN_SCHOOL, email: 'has@example.com' }),
                    },
                    {
                      id: 'needs',
                      data: () => ({ role: 'tester', email: 'needs@example.com', name: 'Needs School' }),
                    },
                  ],
                };
              }
              if (name === 'fitTests') {
                expect({ field, op }).toEqual({ field: 'userId', op: '==' });
                fitTestReads.push(value);
                return {
                  docs: [{
                    data: () => ({ schoolsList: KNOWN_SCHOOL, testLocation: 'Harlem', userId: value }),
                  }],
                };
              }
              throw new Error(`unexpected collection ${name}`);
            },
          };
        },
        doc(uid) {
          return {
            update: async (payload) => {
              userWrites.push({ uid, payload });
            },
          };
        },
      };
    },
  };

  const testers = await readTesters(db);
  expect(fitTestReads).toEqual(['needs']);
  const plan = planSchoolBackfill(testers);
  expect(plan.updates).toEqual([{
    uid: 'needs',
    email: 'needs@example.com',
    name: 'Needs School',
    school: KNOWN_SCHOOL,
  }]);
  expect(plan.skips).toEqual([expect.objectContaining({
    uid: 'already',
    reason: SKIP_REASONS.ALREADY_HAS_SCHOOL,
    school: KNOWN_SCHOOL,
  })]);

  const result = await applySchoolUpdates(db, plan.updates);
  expect(userWrites).toEqual([{ uid: 'needs', payload: { school: KNOWN_SCHOOL } }]);
  expect(Object.keys(userWrites[0].payload)).toEqual(['school']);
  expect(result.written).toEqual([{ uid: 'needs', school: KNOWN_SCHOOL }]);
  expect(result.failed).toEqual([]);

  const calls = [];
  await expect(applySchoolUpdates({
    collection() {
      return {
        doc() {
          return { update: async (payload) => { calls.push(payload); } };
        },
      };
    },
  }, [{ uid: 'bad', school: 'Example Training School', email: 'bad@example.com' }])).rejects.toThrow(
    /unrecognized school/
  );
  expect(calls).toEqual([]);
});
