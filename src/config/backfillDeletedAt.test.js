import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  PROD_PROJECT_ID,
  STAGING_PROJECT_ID,
  applyDeletedAtStamps,
  assertAllowedProject,
  assertEmulatorHost,
  formatReport,
  isPreconditionError,
  loadCredentials,
  needsDeletedAtStamp,
  parseArgs,
  selectStampIds,
  stampPayload,
} from '../../scripts/backfillDeletedAt';

const withCredentialEnv = (filePath, fn) => {
  const previous = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  else process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previous;
  }
};

const writeServiceAccount = (projectId) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-deleted-at-'));
  const filePath = path.join(dir, 'service-account.json');
  fs.writeFileSync(filePath, JSON.stringify({
    client_email: 'backfill@example.iam.gserviceaccount.com',
    private_key: 'not-a-real-key',
    project_id: projectId,
  }));
  return filePath;
};

test('only a fit test with creatorSchool and no deletedAt is stamped', () => {
  expect(needsDeletedAtStamp({ creatorSchool: 'Helene College of Nursing' })).toBe(true);
  expect(needsDeletedAtStamp({
    creatorSchool: 'Helene College of Nursing',
    deletedAt: null,
  })).toBe(false);
  expect(needsDeletedAtStamp({
    creatorSchool: 'Helene College of Nursing',
    deletedAt: { seconds: 1 },
  })).toBe(false);
  expect(needsDeletedAtStamp({ creatorSchool: '   ' })).toBe(false);
  expect(needsDeletedAtStamp({ creatorSchool: '' })).toBe(false);
  expect(needsDeletedAtStamp({})).toBe(false);
  expect(needsDeletedAtStamp(null)).toBe(false);
  expect(selectStampIds([
    { id: 'gap', data: { creatorSchool: 'Helene College of Nursing' } },
    { id: 'stamped', data: { creatorSchool: 'Helene College of Nursing', deletedAt: null } },
    { id: 'legacy', data: { schoolsList: 'Helene College of Nursing' } },
    { id: 'removed', data: { creatorSchool: 'Helene College of Nursing', deletedAt: { seconds: 1 } } },
  ])).toEqual(['gap']);
});

test('the project argument accepts staging and production and nothing else', () => {
  expect(assertAllowedProject(STAGING_PROJECT_ID)).toBe(STAGING_PROJECT_ID);
  expect(assertAllowedProject(PROD_PROJECT_ID)).toBe(PROD_PROJECT_ID);
  expect(() => assertAllowedProject('demo-fit-test-rules')).toThrow(/Refusing project/);
  expect(() => assertAllowedProject('')).toThrow(/Refusing project/);
  expect(parseArgs([
    'node',
    'backfillDeletedAt.js',
    '--project-id',
    STAGING_PROJECT_ID,
    '--dry-run',
  ])).toEqual({
    projectId: STAGING_PROJECT_ID, dryRun: true, write: false, emulator: false,
  });
  expect(parseArgs([
    'node',
    'backfillDeletedAt.js',
    `--project-id=${PROD_PROJECT_ID}`,
    '--write',
  ])).toEqual({
    projectId: PROD_PROJECT_ID, dryRun: false, write: true, emulator: false,
  });
  expect(parseArgs([
    'node',
    'backfillDeletedAt.js',
    '--emulator',
    '--project-id',
    'demo-fit-test-rules',
    '--dry-run',
  ])).toEqual({
    projectId: 'demo-fit-test-rules', dryRun: true, write: false, emulator: true,
  });
  expect(() => parseArgs([
    'node',
    'backfillDeletedAt.js',
    '--emulator',
    '--project-id',
    STAGING_PROJECT_ID,
  ])).toThrow(/demo-\*/);
  const previousHost = process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  try {
    expect(() => assertEmulatorHost()).toThrow(/FIRESTORE_EMULATOR_HOST/);
  } finally {
    if (previousHost === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previousHost;
  }
  expect(parseArgs([
    'node',
    'backfillDeletedAt.js',
    '--project',
    STAGING_PROJECT_ID,
  ]).dryRun).toBe(true);
  expect(() => parseArgs(['node', 'backfillDeletedAt.js', '--dry-run'])).toThrow(/--project-id/);
  expect(() => parseArgs([
    'node',
    'backfillDeletedAt.js',
    '--project-id',
    STAGING_PROJECT_ID,
    '--dry-run',
    '--write',
  ])).toThrow(/not both/);
  expect(() => parseArgs([
    'node',
    'backfillDeletedAt.js',
    '--project-id',
    'other',
  ])).toThrow(/Refusing project "other"/);
});

test('credentials must name the same project, and a dry run lists ids without writing', () => {
  const stagingKey = writeServiceAccount(STAGING_PROJECT_ID);
  const prodKey = writeServiceAccount(PROD_PROJECT_ID);
  expect(withCredentialEnv(stagingKey, () => loadCredentials(STAGING_PROJECT_ID)).project_id)
    .toBe(STAGING_PROJECT_ID);
  expect(withCredentialEnv(prodKey, () => loadCredentials(PROD_PROJECT_ID)).project_id)
    .toBe(PROD_PROJECT_ID);
  expect(() => withCredentialEnv(stagingKey, () => loadCredentials(PROD_PROJECT_ID)))
    .toThrow(/does not match --project-id fit-test-result-e-card-2026/);
  expect(() => withCredentialEnv(undefined, () => loadCredentials(STAGING_PROJECT_ID)))
    .toThrow(/GOOGLE_APPLICATION_CREDENTIALS/);

  const report = formatReport({
    projectId: STAGING_PROJECT_ID,
    ids: ['gap-1'],
    write: false,
  });
  expect(report).toMatch(/Dry run/);
  expect(report).toMatch(/fitTests\/gap-1/);
  expect(report).toMatch(/No documents were written/);
  expect(stampPayload()).toEqual({ deletedAt: null });
});

const fakeDb = (rows, { failBatchOnce = false } = {}) => {
  const updates = [];
  let batchCommits = 0;
  const db = {
    updates,
    collection() {
      return {
        doc(id) {
          return {
            id,
            async get() {
              const row = rows[id];
              return {
                id,
                exists: Boolean(row),
                updateTime: row ? row.updateTime : null,
                ref: { id },
                data: () => (row ? { ...row.data } : undefined),
              };
            },
          };
        },
      };
    },
    batch() {
      const ops = [];
      return {
        update(ref, data, precondition) {
          ops.push({ id: ref.id, data, precondition });
        },
        async commit() {
          batchCommits += 1;
          if (failBatchOnce && batchCommits === 1) {
            const error = new Error('9 FAILED_PRECONDITION: update time precondition failed');
            error.code = 9;
            throw error;
          }
          updates.push(...ops);
        },
      };
    },
  };
  return db;
};

test('a write sets deletedAt to null and no other field', async () => {
  const updateTime = { seconds: 5, nanoseconds: 1 };
  const db = fakeDb({
    'gap-1': { updateTime, data: { creatorSchool: 'Helene College of Nursing' } },
    'gap-2': { updateTime, data: { creatorSchool: 'Helene College of Nursing' } },
  });

  const result = await applyDeletedAtStamps(db, ['gap-1', 'gap-2']);
  expect(result.failed).toEqual([]);
  expect(result.skipped).toEqual([]);
  expect(result.preconditionFailures).toBe(0);
  expect(result.written).toEqual(['gap-1', 'gap-2']);
  expect(db.updates).toEqual([
    {
      id: 'gap-1',
      data: { deletedAt: null },
      precondition: { lastUpdateTime: updateTime },
    },
    {
      id: 'gap-2',
      data: { deletedAt: null },
      precondition: { lastUpdateTime: updateTime },
    },
  ]);
});

test('a precondition failure retries each doc and the next batch still runs', async () => {
  const stale = { seconds: 1, nanoseconds: 0 };
  const fresh = { seconds: 2, nanoseconds: 0 };
  const rows = {
    'soft-deleted': { creatorSchool: 'Helene College of Nursing' },
    'still-open': { creatorSchool: 'Helene College of Nursing' },
    later: { creatorSchool: 'Helene College of Nursing' },
  };
  const updates = [];
  let failedOnce = false;
  let retrying = false;
  const db = {
    updates,
    collection() {
      return {
        doc(id) {
          return {
            id,
            async get() {
              const data = { ...rows[id] };
              if (retrying && id === 'soft-deleted') data.deletedAt = { seconds: 9 };
              return {
                id,
                exists: true,
                updateTime: id === 'later' ? fresh : stale,
                ref: { id },
                data: () => data,
              };
            },
          };
        },
      };
    },
    batch() {
      const ops = [];
      return {
        update(ref, data, precondition) {
          ops.push({ id: ref.id, data, precondition });
        },
        async commit() {
          if (!failedOnce) {
            failedOnce = true;
            retrying = true;
            const error = new Error('9 FAILED_PRECONDITION: update time precondition failed');
            error.code = 9;
            throw error;
          }
          updates.push(...ops);
        },
      };
    },
  };

  const result = await applyDeletedAtStamps(db, ['soft-deleted', 'still-open', 'later'], {
    batchSize: 2,
  });

  expect(isPreconditionError({ code: 9, message: 'FAILED_PRECONDITION' })).toBe(true);
  expect(result.preconditionFailures).toBe(1);
  expect(result.skipped).toEqual(['soft-deleted']);
  expect(result.written).toEqual(['still-open', 'later']);
  expect(result.failed).toEqual([]);
  expect(updates.map((entry) => entry.id)).toEqual(['still-open', 'later']);
  updates.forEach((entry) => {
    expect(entry.data).toEqual({ deletedAt: null });
    expect(entry.precondition.lastUpdateTime).toBeTruthy();
  });
});
