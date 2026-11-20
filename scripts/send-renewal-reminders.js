// Daily renewal reminder emails for fit tests that are coming due.
//
// Run by .github/workflows/renewal-reminders.yml once a day. It can also be
// run by hand:
//
//   export FIREBASE_SERVICE_ACCOUNT="$(cat /absolute/path/to/service-account.json)"
//   export EMAILJS_SERVICE_ID=... EMAILJS_RENEWAL_TEMPLATE_ID=... EMAILJS_PUBLIC_KEY=...
//   export EMAILJS_PRIVATE_KEY=...   # needed when EmailJS strict mode is on
//   node scripts/send-renewal-reminders.js --dry-run
//   node scripts/send-renewal-reminders.js
//
// Who gets an email: a fit test with renewalReminderOptIn == true (the
// "Remind me next year" box on the card form) whose test date (issueDate,
// MM/DD/YYYY) is 335 to 365 days old, so the email goes out about 30 days
// before the yearly due date. The record must have a result of Pass, a
// recipient email, and an e-card that was sent (emailSentAt set). Soft-deleted
// records (deletedAt set) are skipped, and so is a test whose worker already has
// a later test on file under the same email.
//
// Dedupe: before each email is sent, a Firestore transaction reads the
// record, verifies renewalReminderSentFor is not yet set for this due year, and
// writes renewalReminderSentFor = <due year> and renewalReminderSentAt = server
// time. EmailJS is called only after the transaction commits, so a send failure
// after stamping skips that year's reminder rather than duplicating it.
//
// Quota: at most MAX_SENDS_PER_RUN (50) sends per run, about 1 per second, so
// the EmailJS free plan (200 requests a month, shared with e-card emails) is
// not used up by one run. Anything over the cap stays in the window and is
// picked up by the next day's run.
//
// --dry-run (or DRY_RUN=1) reads Firestore and prints counts and masked
// emails only. It sends nothing and writes nothing. With the staging service
// account only @example.com recipients are emailed, like the app's staging
// build. Full emails and secrets are never printed. The service account project_id must be the staging or
// production project. Do not commit the service account file.

const ALLOWED_PROJECT_IDS = new Set([
  'fit-test-result-e-card-staging',
  'fit-test-result-e-card-2026',
]);
const FIT_TESTS_COLLECTION = 'fitTests';
const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const WINDOW_MIN_DAYS = 335;
const WINDOW_MAX_DAYS = 365;
const MAX_SENDS_PER_RUN = 50;
const THROTTLE_MS = 1100;
const DAY_MS = 24 * 60 * 60 * 1000;
const STAGING_PROJECT_ID = 'fit-test-result-e-card-staging';
// Same rule as assertStagingRecipient in src/services/emailService.js: the
// staging project never emails a real customer.
const STAGING_RECIPIENT = /^[^@\s,;"?]+@example\.com$/i;
const BOOKING_LINKS = {
  booking_manhattan: 'https://calendly.com/Securefit2024',
  booking_brooklyn: 'https://calendly.com/securefit-bk/15-mins',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTruthyFlag = (value) => /^(1|true|yes)$/i.test(String(value || '').trim());

const parseArgs = (argv = process.argv, env = process.env) => {
  const args = argv.slice(2);
  let dryRun = isTruthyFlag(env.DRY_RUN);
  args.forEach((arg) => {
    if (arg === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error(`Unknown argument ${arg}. The only option is --dry-run.`);
    }
  });
  return { dryRun };
};

// "john.doe@example.com" -> "j***@e***.com". Never log a full address.
const maskEmail = (email) => {
  const value = String(email || '').trim();
  const at = value.lastIndexOf('@');
  if (at < 1) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local[0]}***@${domainName ? `${domainName[0]}***` : '***'}${tld}`;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// MM/DD/YYYY -> UTC midnight Date, or null when it is not a real date.
const parseUsDate = (value) => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value || '').trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
};

const formatUsDate = (date) => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}/${day}/${date.getUTCFullYear()}`;
};

const utcDay = (now) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

const daysSince = (date, now) => Math.round((utcDay(now) - date.getTime()) / DAY_MS);

// Stored expirationDate when it is valid, otherwise test date + 1 year (the
// same rule as calculateExpirationDate in src/utils/dateUtils.js).
const dueDateFor = (data, testDate) => {
  const stored = parseUsDate(data.expirationDate);
  if (stored) return stored;
  const due = new Date(testDate.getTime());
  due.setUTCFullYear(due.getUTCFullYear() + 1);
  return due;
};

const hasField = (data, field) => Object.prototype.hasOwnProperty.call(data, field);

// Mirrors isFitTestEmailSent in src/components/results/resultsUtils.js:
// a missing emailSentAt is a legacy sent card, null means saved but not sent.
const wasCardSent = (data) => {
  if (!hasField(data, 'emailSentAt') || data.emailSentAt === undefined) return true;
  return data.emailSentAt != null && data.emailSentAt !== '';
};

/**
 * Decide whether one fit test should get a reminder today.
 * @returns {{ eligible: boolean, reason: string, testDate?: Date, dueDate?: Date, dueYear?: number }}
 */
const classifyFitTest = (data, now = new Date()) => {
  if (!data || typeof data !== 'object') return { eligible: false, reason: 'invalid' };
  if (data.renewalReminderOptIn !== true) return { eligible: false, reason: 'not-opted-in' };
  if (data.deletedAt != null) return { eligible: false, reason: 'deleted' };
  if (!wasCardSent(data)) return { eligible: false, reason: 'unsent' };
  if (data.result !== 'Pass') return { eligible: false, reason: 'not-passed' };
  const email = String(data.recipientEmail || '').trim();
  if (!email || !email.includes('@')) return { eligible: false, reason: 'no-email' };
  const testDate = parseUsDate(data.issueDate);
  if (!testDate) return { eligible: false, reason: 'invalid-date' };
  const age = daysSince(testDate, now);
  if (age < WINDOW_MIN_DAYS || age > WINDOW_MAX_DAYS) {
    return { eligible: false, reason: 'outside-window' };
  }
  const dueDate = dueDateFor(data, testDate);
  const dueYear = dueDate.getUTCFullYear();
  if (data.renewalReminderSentFor === dueYear) {
    return { eligible: false, reason: 'already-reminded' };
  }
  return { eligible: true, reason: 'eligible', testDate, dueDate, dueYear };
};

/**
 * Pick reminders from [{ id, data }] entries. One email per recipient per run.
 * @returns {{ selected: Array, skipped: Record<string, number> }}
 */
const selectReminders = (docs, now = new Date()) => {
  const skipped = {};
  const selected = [];
  const seenRecipients = new Set();
  docs.forEach((entry) => {
    const result = classifyFitTest(entry && entry.data, now);
    if (!result.eligible) {
      skipped[result.reason] = (skipped[result.reason] || 0) + 1;
      return;
    }
    const recipient = normalizeEmail(entry.data.recipientEmail);
    if (seenRecipients.has(recipient)) {
      skipped['duplicate-recipient'] = (skipped['duplicate-recipient'] || 0) + 1;
      return;
    }
    seenRecipients.add(recipient);
    selected.push({ ...entry, ...result });
  });
  selected.sort((a, b) => a.testDate - b.testDate);
  return { selected, skipped };
};

// True when another live fit test for the same email has a later test date,
// meaning the worker has already been retested.
const hasLaterTest = (candidate, otherDocs) => otherDocs.some((other) => {
  if (!other || other.id === candidate.id) return false;
  const data = other.data || {};
  if (data.deletedAt != null) return false;
  const otherDate = parseUsDate(data.issueDate);
  return Boolean(otherDate) && otherDate > candidate.testDate;
});

const buildTemplateParams = (candidate) => {
  const data = candidate.data;
  return {
    to_email: String(data.recipientEmail).trim(),
    to_name: String(data.clientName || '').trim() || 'there',
    test_date: formatUsDate(candidate.testDate),
    due_date: formatUsDate(candidate.dueDate),
    test_type: data.fitTestType || '',
    respirator_make: data.respiratorMfg || '',
    respirator_model: data.model || '',
    respirator_size: data.maskSize || '',
    respirator_style: data.style || '',
    ...BOOKING_LINKS,
  };
};

const readEmailJsConfig = (env = process.env) => {
  const config = {
    serviceId: String(env.EMAILJS_SERVICE_ID || '').trim(),
    templateId: String(env.EMAILJS_RENEWAL_TEMPLATE_ID || '').trim(),
    publicKey: String(env.EMAILJS_PUBLIC_KEY || '').trim(),
    privateKey: String(env.EMAILJS_PRIVATE_KEY || '').trim(),
  };
  const missing = [
    ['EMAILJS_SERVICE_ID', config.serviceId],
    ['EMAILJS_RENEWAL_TEMPLATE_ID', config.templateId],
    ['EMAILJS_PUBLIC_KEY', config.publicKey],
  ].filter(([, value]) => !value).map(([name]) => name);
  return { config, missing };
};

const buildEmailJsBody = (config, templateParams) => ({
  service_id: config.serviceId,
  template_id: config.templateId,
  user_id: config.publicKey,
  ...(config.privateKey ? { accessToken: config.privateKey } : {}),
  template_params: templateParams,
});

class EmailJsError extends Error {
  constructor(status, text) {
    // EmailJS error text does not echo keys, but cap it anyway.
    super(`EmailJS returned ${status}: ${String(text || '').slice(0, 200)}`);
    this.status = status;
  }
}

const sendViaEmailJs = async (config, templateParams, fetchImpl = globalThis.fetch) => {
  const response = await fetchImpl(EMAILJS_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEmailJsBody(config, templateParams)),
  });
  if (!response.ok) {
    let text = '';
    try {
      text = await response.text();
    } catch (_error) {
      text = '';
    }
    throw new EmailJsError(response.status, text);
  }
};

const parseServiceAccount = (raw) => {
  if (!raw || !String(raw).trim()) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT to the service account JSON (the file contents, not a path).');
  }
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch (_error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
  }
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('Service account JSON is missing client_email, private_key, or project_id.');
  }
  if (!ALLOWED_PROJECT_IDS.has(parsed.project_id)) {
    throw new Error(`Refusing project "${parsed.project_id}". Use the staging or production service account.`);
  }
  return parsed;
};

/**
 * One reminder run. Every dependency is passed in so tests can run it with mocks.
 * @param {object} deps
 * @param {() => Promise<Array<{id, data}>>} deps.loadOptedIn
 * @param {(email: string) => Promise<Array<{id, data}>>} deps.loadByEmail
 * @param {(templateParams: object) => Promise<void>} deps.send
 * @param {(id: string, dueYear: number) => Promise<void>} deps.markSent
 */
const runReminders = async ({
  loadOptedIn,
  loadByEmail,
  send,
  markSent,
  now = new Date(),
  dryRun = false,
  allowRecipient = () => true,
  maxSends = MAX_SENDS_PER_RUN,
  throttleMs = THROTTLE_MS,
  wait = sleep,
  log = console.log,
}) => {
  const docs = await loadOptedIn();
  const { selected, skipped } = selectReminders(docs, now);
  const summary = {
    optedIn: docs.length,
    eligible: selected.length,
    sent: 0,
    wouldSend: 0,
    retested: 0,
    deferred: 0,
    failed: 0,
    skipped,
  };

  log(`${docs.length} opted-in fit test(s); ${selected.length} in the ${WINDOW_MIN_DAYS}-${WINDOW_MAX_DAYS} day window and not yet reminded.`);
  Object.keys(skipped).sort().forEach((reason) => log(`  skipped ${reason}: ${skipped[reason]}`));

  let attempts = 0;
  let sendAttempts = 0;
  for (let index = 0; index < selected.length; index += 1) {
    const candidate = selected[index];
    if (attempts >= maxSends) {
      summary.deferred = selected.length - index;
      log(`Per-run cap of ${maxSends} reached; ${summary.deferred} left for the next run.`);
      break;
    }
    const masked = maskEmail(candidate.data.recipientEmail);
    if (!allowRecipient(String(candidate.data.recipientEmail).trim())) {
      summary.skipped['staging-recipient'] = (summary.skipped['staging-recipient'] || 0) + 1;
      log(`  skip fitTests/${candidate.id} (${masked}): staging only emails @example.com.`);
      continue;
    }
    const sameEmail = await loadByEmail(String(candidate.data.recipientEmail).trim());
    if (hasLaterTest(candidate, sameEmail)) {
      summary.retested += 1;
      log(`  skip fitTests/${candidate.id} (${masked}): a later test is on file.`);
      continue;
    }
    attempts += 1;
    const params = buildTemplateParams(candidate);
    if (dryRun) {
      summary.wouldSend += 1;
      log(`  would remind fitTests/${candidate.id} (${masked}), due ${params.due_date}.`);
      continue;
    }
    let claimed;
    try {
      claimed = await markSent(candidate.id, candidate.dueYear);
    } catch (error) {
      summary.failed += 1;
      log(`  FAILED to stamp fitTests/${candidate.id} (${masked}); skipping send: ${error.message}`);
      continue;
    }
    if (claimed === false) {
      summary.skipped['already-reminded'] = (summary.skipped['already-reminded'] || 0) + 1;
      log(`  skip fitTests/${candidate.id} (${masked}): already stamped for ${candidate.dueYear}.`);
      continue;
    }
    sendAttempts += 1;
    if (sendAttempts > 1 && throttleMs > 0) await wait(throttleMs);
    try {
      await send(params);
    } catch (error) {
      summary.failed += 1;
      log(`  FAILED fitTests/${candidate.id} (${masked}) after stamping for ${candidate.dueYear}; skipping retry this year: ${error.message}`);
      if (error.status === 429 || error.status === 402) {
        log('EmailJS rate limit or quota reached; stopping this run.');
        break;
      }
      continue;
    }
    summary.sent += 1;
    log(`  reminded fitTests/${candidate.id} (${masked}), due ${params.due_date}.`);
  }

  log(dryRun
    ? `Dry run: ${summary.wouldSend} reminder(s) would be sent. Nothing was sent or written.`
    : `Sent ${summary.sent} reminder(s); ${summary.failed} failed.`);
  return summary;
};

// Atomically claim the due-year reminder stamp before calling EmailJS so a
// concurrent run or a send failure after commit never duplicates an email.
const claimReminderStamp = ({ db, fitTests, serverTimestamp }) => (id, dueYear) =>
  db.runTransaction(async (tx) => {
    const ref = fitTests.doc(id);
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() || {}) : null;
    if (
      !data ||
      data.deletedAt != null ||
      data.renewalReminderOptIn !== true ||
      data.renewalReminderSentFor === dueYear
    ) {
      return false;
    }
    tx.update(ref, {
      renewalReminderSentFor: dueYear,
      renewalReminderSentAt: serverTimestamp(),
    });
    return true;
  });

const main = async () => {
  const { dryRun } = parseArgs();
  const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  const { config, missing } = readEmailJsConfig();
  if (!dryRun && missing.length) {
    throw new Error(`Missing ${missing.join(', ')}. Set them, or pass --dry-run.`);
  }

  // Loaded here so the unit tests never touch firebase-admin.
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  const db = admin.firestore();
  const fitTests = db.collection(FIT_TESTS_COLLECTION);
  const toEntries = (snap) => snap.docs.map((entry) => ({ id: entry.id, data: entry.data() || {} }));

  console.log(`${dryRun ? 'Dry run' : 'Sending'} renewal reminders on project ${serviceAccount.project_id}.`);
  const summary = await runReminders({
    dryRun,
    allowRecipient: serviceAccount.project_id === STAGING_PROJECT_ID
      ? (email) => STAGING_RECIPIENT.test(email)
      : () => true,
    loadOptedIn: async () => toEntries(await fitTests.where('renewalReminderOptIn', '==', true).get()),
    loadByEmail: async (email) => toEntries(await fitTests.where('recipientEmail', '==', email).get()),
    send: (params) => sendViaEmailJs(config, params),
    markSent: claimReminderStamp({
      db,
      fitTests,
      serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
    }),
  });
  if (summary.failed > 0) {
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
  ALLOWED_PROJECT_IDS,
  BOOKING_LINKS,
  EMAILJS_SEND_URL,
  EmailJsError,
  MAX_SENDS_PER_RUN,
  STAGING_RECIPIENT,
  THROTTLE_MS,
  WINDOW_MAX_DAYS,
  WINDOW_MIN_DAYS,
  buildEmailJsBody,
  buildTemplateParams,
  claimReminderStamp,
  classifyFitTest,
  hasLaterTest,
  maskEmail,
  parseArgs,
  parseServiceAccount,
  parseUsDate,
  readEmailJsConfig,
  runReminders,
  selectReminders,
  sendViaEmailJs,
};
