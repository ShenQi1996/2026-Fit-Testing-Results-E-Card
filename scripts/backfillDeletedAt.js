// One-time stamp of deletedAt: null on fit tests that faculty can see.
//
// Faculty queries require deletedAt == null. Records created after the faculty
// role ships and before that field is stamped have creatorSchool and no
// deletedAt, so faculty cannot read them. Run this once on staging and once
// on production, before or right after that rules change is deployed. It is
// not part of CI and this repo does not run it.
//
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
//   npm run backfill:deleted-at -- --project-id fit-test-result-e-card-staging --dry-run
//   npm run backfill:deleted-at -- --project-id fit-test-result-e-card-staging --write
//   npm run backfill:deleted-at -- --project-id fit-test-result-e-card-2026 --dry-run
//   npm run backfill:deleted-at -- --project-id fit-test-result-e-card-2026 --write
//
// Dry run is the default. --dry-run writes nothing. --write sets deletedAt to
// null and changes no other field. A second run changes nothing: a document
// that already has deletedAt, including null, is skipped. A document with no
// creatorSchool is skipped. The service account project_id must match
// --project-id. Do not commit the service account file.

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

const assertAllowedProject = (projectId) => {
  const id = typeof projectId === 'string' ? projectId.trim() : '';
  if (!ALLOWED_PROJECT_IDS.has(id)) {
    throw new Error(
      `Refusing project "${id}". Pass --project-id ${STAGING_PROJECT_ID} or ${PROD_PROJECT_ID}.`
    );
  }
  return id;
};

const parseArgs = (argv) => {
  const args = argv.slice(2);
  let projectId = '';
  let dryRun = false;
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--write') {
      write = true;
    } else if (arg === '--project' || arg === '--project-id') {
      projectId = args[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--project=')) {
      projectId = arg.slice('--project='.length);
    } else if (arg.startsWith('--project-id=')) {
      projectId = arg.slice('--project-id='.length);
    } else {
      throw new Error(
        `Unknown argument ${arg}. Pass --project-id and optional --dry-run or --write.`
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
    projectId: assertAllowedProject(projectId),
    dryRun: !write,
    write,
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

const applyDeletedAtStamps = async (db, ids) => {
  const written = [];
  const failed = [];

  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const chunk = ids.slice(start, start + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((id) => {
      batch.update(db.collection('fitTests').doc(id), stampPayload());
    });
    try {
      await batch.commit();
      written.push(...chunk);
    } catch (error) {
      chunk.forEach((id) => failed.push({ id, message: error.message || String(error) }));
      console.error(`Failed to stamp deletedAt on ${chunk.length} fit test(s):`, error.message || error);
    }
  }

  return { written, failed };
};

const connectAdmin = async (serviceAccount) => {
  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  return {
    db: admin.firestore(),
    documentId: admin.firestore.FieldPath.documentId(),
  };
};

const backfillDeletedAt = async ({ argv = process.argv } = {}) => {
  const options = parseArgs(argv);
  const serviceAccount = loadCredentials(options.projectId);
  const { db, documentId } = await connectAdmin(serviceAccount);
  const ids = await readStampCandidates(db, documentId);
  console.log(formatReport({ projectId: options.projectId, ids, write: options.write }));
  if (!options.write) return { ...options, ids, written: [], failed: [] };

  const result = await applyDeletedAtStamps(db, ids);
  console.log(`Stamped deletedAt: null on ${result.written.length} fit test(s).`);
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
  formatReport,
  loadCredentials,
  needsDeletedAtStamp,
  parseArgs,
  selectStampIds,
  stampPayload,
};
