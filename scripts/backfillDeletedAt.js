// One-time stamp of deletedAt: null on fit tests that faculty can see.
//
// Faculty queries require deletedAt == null. Records created after the faculty
// role ships and before that field is stamped have creatorSchool and no
// deletedAt, so faculty cannot read them. Run this once on staging and once
// on production before that rules change is deployed. Do not deploy first.
// It is not part of CI and this repo does not run it.
//
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
//   npm run backfill:deleted-at -- --project-id fit-test-result-e-card-staging --dry-run
//   npm run backfill:deleted-at -- --project-id fit-test-result-e-card-staging --write
//   npm run backfill:deleted-at -- --project-id fit-test-result-e-card-2026 --dry-run
//   npm run backfill:deleted-at -- --project-id fit-test-result-e-card-2026 --write
//
// Dry run is the default. --dry-run writes nothing. --write sets deletedAt to
// null and changes no other field. Each write is conditioned on the document's
// updateTime, so a concurrent soft delete is not overwritten. A failed
// precondition is counted and logged, that batch is retried one document at a
// time, and a document that now has deletedAt is skipped. A second run changes
// nothing: a document that already has deletedAt, including null, is skipped.
// A document with no creatorSchool is skipped. The service account project_id
// must match --project-id. Do not commit the service account file.
//
// --emulator talks only to FIRESTORE_EMULATOR_HOST and only accepts a demo-*
// project id. It does not load a service account.

const fs = require('fs');
const path = require('path');

const STAGING_PROJECT_ID = 'fit-test-result-e-card-staging';
const PROD_PROJECT_ID = 'fit-test-result-e-card-2026';
const ALLOWED_PROJECT_IDS = new Set([STAGING_PROJECT_ID, PROD_PROJECT_ID]);
const PAGE_SIZE = 300;
const BATCH_SIZE = 400;

const needsDeletedAtStamp = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(data, 'deletedAt')) return false;
  return typeof data.creatorSchool === 'string' && data.creatorSchool.trim() !== '';
};

const selectStampIds = (docs) => docs
  .filter((entry) => needsDeletedAtStamp(entry && entry.data))
  .map((entry) => entry.id);

const DEMO_PROJECT_ID = /^demo-[A-Za-z0-9-]+$/;

const assertAllowedProject = (projectId, { emulator = false } = {}) => {
  const id = typeof projectId === 'string' ? projectId.trim() : '';
  if (emulator) {
    if (!DEMO_PROJECT_ID.test(id)) {
      throw new Error(
        `Refusing project "${id}" with --emulator. Pass a demo-* project id.`
      );
    }
    return id;
  }
  if (!ALLOWED_PROJECT_IDS.has(id)) {
    throw new Error(
      `Refusing project "${id}". Pass --project-id ${STAGING_PROJECT_ID} or ${PROD_PROJECT_ID}.`
    );
  }
  return id;
};

const assertEmulatorHost = () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host || !String(host).trim()) {
    throw new Error(
      'Set FIRESTORE_EMULATOR_HOST before --emulator. This script will not connect to a real project in emulator mode.'
    );
  }
  return String(host).trim();
};

const parseArgs = (argv) => {
  const args = argv.slice(2);
  let projectId = '';
  let dryRun = false;
  let write = false;
  let emulator = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--write') {
      write = true;
    } else if (arg === '--emulator') {
      emulator = true;
    } else if (arg === '--project' || arg === '--project-id') {
      projectId = args[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--project=')) {
      projectId = arg.slice('--project='.length);
    } else if (arg.startsWith('--project-id=')) {
      projectId = arg.slice('--project-id='.length);
    } else {
      throw new Error(
        `Unknown argument ${arg}. Pass --project-id and optional --dry-run, --write, or --emulator.`
      );
    }
  }

  if (dryRun && write) {
    throw new Error('Pass either --dry-run or --write, not both.');
  }
  if (!String(projectId).trim()) {
    throw new Error(
      `Pass --project-id ${STAGING_PROJECT_ID} or ${PROD_PROJECT_ID}.`
    );
  }

  return {
    projectId: assertAllowedProject(projectId, { emulator }),
    dryRun: !write,
    write,
    emulator,
  };
};

const stampPayload = () => ({ deletedAt: null });

const loadCredentials = (projectId) => {
  const expected = assertAllowedProject(projectId);
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!filePath || !String(filePath).trim()) {
    throw new Error(
      'Set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON path. Do not commit that file.'
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
  if (parsed.project_id !== expected) {
    throw new Error(
      `Service account project_id is ${parsed.project_id}, which does not match --project-id ${expected}.`
    );
  }
  return parsed;
};

const formatReport = ({ projectId, ids, write }) => {
  const lines = [
    `${write ? 'Writing' : 'Dry run'} deletedAt: null on project ${projectId}.`,
    `${ids.length} fit test(s) have creatorSchool and no deletedAt.`,
  ];
  ids.forEach((id) => lines.push(`fitTests/${id}`));
  if (!write) lines.push('No documents were written. Pass --write to stamp them.');
  return lines.join('\n');
};

const readStampCandidates = async (db, documentId) => {
  const ids = [];
  let last = null;

  for (;;) {
    let query = db.collection('fitTests').orderBy(documentId).limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    snap.docs.forEach((entry) => {
      if (needsDeletedAtStamp(entry.data() || {})) ids.push(entry.id);
    });
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  return ids;
};

const isPreconditionError = (error) => {
  const code = error && error.code;
  if (code === 9 || code === '9' || code === 'failed-precondition' || code === 'FAILED_PRECONDITION') {
    return true;
  }
  const message = String((error && (error.message || error.details)) || '');
  return /FAILED_PRECONDITION|failed-precondition/i.test(message);
};

const readFitTest = async (db, id) => db.collection('fitTests').doc(id).get();

const applyDeletedAtStamps = async (db, ids, { batchSize = BATCH_SIZE, beforeCommit } = {}) => {
  const written = [];
  const failed = [];
  const skipped = [];
  let preconditionFailures = 0;

  const rememberSkip = (id, data) => {
    if (!data) {
      console.error(`Skipping fitTests/${id}: the document is gone.`);
    } else if (data.deletedAt == null) {
      console.error(`Skipping fitTests/${id}: deletedAt is already set.`);
    } else {
      console.error(`Skipping fitTests/${id}: deletedAt is now set, so the soft delete was left in place.`);
    }
    skipped.push(id);
  };

  const stampOne = async (id) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const snap = await readFitTest(db, id);
      const data = snap.exists ? (snap.data() || {}) : null;
      if (!data || !needsDeletedAtStamp(data)) {
        rememberSkip(id, data);
        return;
      }
      const batch = db.batch();
      batch.update(snap.ref, stampPayload(), { lastUpdateTime: snap.updateTime });
      try {
        await batch.commit();
        written.push(id);
        return;
      } catch (error) {
        if (!isPreconditionError(error)) {
          failed.push({ id, message: error.message || String(error) });
          console.error(`Failed to stamp deletedAt on fitTests/${id}:`, error.message || error);
          return;
        }
        preconditionFailures += 1;
        console.error(`Precondition failed for fitTests/${id}. Re-reading.`);
      }
    }

    const snap = await readFitTest(db, id);
    const data = snap.exists ? (snap.data() || {}) : null;
    if (!data || !needsDeletedAtStamp(data)) {
      rememberSkip(id, data);
      return;
    }
    failed.push({ id, message: 'Precondition failed and deletedAt is still absent.' });
    console.error(`Failed to stamp deletedAt on fitTests/${id} after a precondition failure.`);
  };

  for (let start = 0; start < ids.length; start += batchSize) {
    const chunk = ids.slice(start, start + batchSize);
    const snaps = [];
    for (const id of chunk) {
      const snap = await readFitTest(db, id);
      const data = snap.exists ? (snap.data() || {}) : null;
      if (!data || !needsDeletedAtStamp(data)) {
        rememberSkip(id, data);
        continue;
      }
      snaps.push(snap);
    }
    if (snaps.length === 0) continue;
    if (typeof beforeCommit === 'function') await beforeCommit(snaps);

    const batch = db.batch();
    snaps.forEach((snap) => {
      batch.update(snap.ref, stampPayload(), { lastUpdateTime: snap.updateTime });
    });
    try {
      await batch.commit();
      written.push(...snaps.map((snap) => snap.id));
    } catch (error) {
      if (!isPreconditionError(error)) {
        snaps.forEach((snap) => failed.push({ id: snap.id, message: error.message || String(error) }));
        console.error(
          `Failed to stamp deletedAt on ${snaps.length} fit test(s). Later batches still run:`,
          error.message || error
        );
        continue;
      }
      preconditionFailures += 1;
      const idsInBatch = snaps.map((snap) => snap.id);
      console.error(
        `Precondition failed for fitTests/${idsInBatch.join(', ')}. Retrying each document. Later batches still run.`
      );
      for (const snap of snaps) {
        await stampOne(snap.id);
      }
    }
  }

  return { written, failed, skipped, preconditionFailures };
};

const connectAdmin = async (serviceAccount, { emulator = false, projectId } = {}) => {
  const admin = require('firebase-admin');
  const name = `backfill-deleted-at-${projectId || 'default'}`;
  const existing = admin.apps.find((app) => app && app.name === name);
  if (emulator) {
    assertEmulatorHost();
    const app = existing || admin.initializeApp({ projectId }, name);
    return {
      db: app.firestore(),
      documentId: admin.firestore.FieldPath.documentId(),
    };
  }
  const app = existing || admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  }, name);
  return {
    db: app.firestore(),
    documentId: admin.firestore.FieldPath.documentId(),
  };
};

const backfillDeletedAt = async ({ argv = process.argv } = {}) => {
  const options = parseArgs(argv);
  if (options.emulator) assertEmulatorHost();
  const serviceAccount = options.emulator ? null : loadCredentials(options.projectId);
  const { db, documentId } = await connectAdmin(serviceAccount, options);
  const ids = await readStampCandidates(db, documentId);
  console.log(formatReport({ projectId: options.projectId, ids, write: options.write }));
  if (!options.write) return { ...options, ids, written: [], failed: [], skipped: [], preconditionFailures: 0 };

  const result = await applyDeletedAtStamps(db, ids);
  console.log(`Stamped deletedAt: null on ${result.written.length} fit test(s).`);
  console.log(`Skipped ${result.skipped.length} fit test(s) that already have deletedAt.`);
  console.log(`Precondition failures: ${result.preconditionFailures}.`);
  if (result.failed.length > 0) {
    throw new Error(`Failed to stamp deletedAt on ${result.failed.length} fit test(s).`);
  }
  return { ...options, ids, ...result };
};

if (require.main === module) {
  backfillDeletedAt().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  ALLOWED_PROJECT_IDS,
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
};
