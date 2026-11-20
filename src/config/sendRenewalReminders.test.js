import {
  BOOKING_LINKS,
  EMAILJS_SEND_URL,
  EmailJsError,
  STAGING_RECIPIENT,
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
} from '../../scripts/send-renewal-reminders';

const NOW = new Date('2026-11-19T14:00:00Z');

// 350 days before NOW is 12/04/2025, inside the 335-365 day window.
const record = (extra = {}) => ({
  renewalReminderOptIn: true,
  deletedAt: null,
  emailSentAt: { seconds: 1 },
  result: 'Pass',
  recipientEmail: 'worker@example.com',
  clientName: 'Pat Worker',
  issueDate: '12/04/2025',
  expirationDate: '12/04/2026',
  fitTestType: 'N95',
  respiratorMfg: '3M',
  model: '1860',
  maskSize: 'Regular',
  style: 'Cup (molded)',
  ...extra,
});

const silent = () => {};

describe('parseUsDate and maskEmail', () => {
  test('parses MM/DD/YYYY and rejects impossible dates', () => {
    expect(parseUsDate('12/04/2025').toISOString()).toBe('2025-12-04T00:00:00.000Z');
    expect(parseUsDate('02/30/2026')).toBeNull();
    expect(parseUsDate('2025-12-04')).toBeNull();
    expect(parseUsDate('')).toBeNull();
  });

  test('never returns the full address', () => {
    expect(maskEmail('john.doe@example.com')).toBe('j***@e***.com');
    expect(maskEmail('a@b.org')).toBe('a***@b***.org');
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('')).toBe('***');
  });
});

describe('classifyFitTest', () => {
  test('an opted-in, sent, passed test 350 days old is eligible', () => {
    const result = classifyFitTest(record(), NOW);
    expect(result.eligible).toBe(true);
    expect(result.dueYear).toBe(2026);
  });

  test.each([
    ['not-opted-in', { renewalReminderOptIn: false }],
    ['not-opted-in', { renewalReminderOptIn: 'true' }],
    ['deleted', { deletedAt: { seconds: 5 } }],
    ['unsent', { emailSentAt: null }],
    ['not-passed', { result: 'Fail' }],
    ['no-email', { recipientEmail: '  ' }],
    ['invalid-date', { issueDate: 'soon' }],
    ['outside-window', { issueDate: '12/20/2025' }],
    ['outside-window', { issueDate: '11/18/2025' }],
    ['already-reminded', { renewalReminderSentFor: 2026 }],
  ])('skips %s', (reason, extra) => {
    expect(classifyFitTest(record(extra), NOW)).toEqual({ eligible: false, reason });
  });

  test('window edges are 335 and 365 days', () => {
    expect(classifyFitTest(record({ issueDate: '12/19/2025' }), NOW).eligible).toBe(true);
    expect(classifyFitTest(record({ issueDate: '11/19/2025' }), NOW).eligible).toBe(true);
  });

  test('a legacy record without emailSentAt counts as sent', () => {
    const data = record();
    delete data.emailSentAt;
    expect(classifyFitTest(data, NOW).eligible).toBe(true);
  });

  test('a reminder sent for an earlier due year does not block this one', () => {
    expect(classifyFitTest(record({ renewalReminderSentFor: 2025 }), NOW).eligible).toBe(true);
  });

  test('a missing expirationDate falls back to test date + 1 year', () => {
    const result = classifyFitTest(record({ expirationDate: '' }), NOW);
    expect(result.dueDate.toISOString()).toBe('2026-12-04T00:00:00.000Z');
  });
});

describe('selectReminders', () => {
  test('counts skip reasons and sends one email per recipient, oldest first', () => {
    const { selected, skipped } = selectReminders([
      { id: 'newer', data: record({ issueDate: '12/10/2025' }) },
      { id: 'older', data: record({ issueDate: '12/01/2025', recipientEmail: 'other@example.com' }) },
      { id: 'dupe', data: record({ issueDate: '12/11/2025', recipientEmail: 'WORKER@example.com' }) },
      { id: 'gone', data: record({ deletedAt: { seconds: 1 } }) },
      { id: 'done', data: record({ renewalReminderSentFor: 2026 }) },
    ], NOW);
    expect(selected.map((entry) => entry.id)).toEqual(['older', 'newer']);
    expect(skipped).toEqual({ 'duplicate-recipient': 1, deleted: 1, 'already-reminded': 1 });
  });
});

describe('hasLaterTest', () => {
  const candidate = { id: 'ft-1', testDate: parseUsDate('12/04/2025') };
  test('a later live test for the same email means already retested', () => {
    expect(hasLaterTest(candidate, [
      { id: 'ft-1', data: record() },
      { id: 'ft-2', data: { issueDate: '06/01/2026', deletedAt: null } },
    ])).toBe(true);
  });
  test('earlier, deleted, or undated tests do not count', () => {
    expect(hasLaterTest(candidate, [
      { id: 'ft-1', data: record() },
      { id: 'ft-0', data: { issueDate: '01/01/2025' } },
      { id: 'ft-3', data: { issueDate: '06/01/2026', deletedAt: { seconds: 1 } } },
      { id: 'ft-4', data: { issueDate: '' } },
    ])).toBe(false);
  });
});

describe('EmailJS payload', () => {
  const config = { serviceId: 'svc', templateId: 'tpl_renew', publicKey: 'pub', privateKey: '' };

  test('template params carry dates, respirator, and both booking links', () => {
    const [candidate] = selectReminders([{ id: 'ft-1', data: record() }], NOW).selected;
    expect(buildTemplateParams(candidate)).toEqual({
      to_email: 'worker@example.com',
      to_name: 'Pat Worker',
      test_date: '12/04/2025',
      due_date: '12/04/2026',
      test_type: 'N95',
      respirator_make: '3M',
      respirator_model: '1860',
      respirator_size: 'Regular',
      respirator_style: 'Cup (molded)',
      booking_manhattan: 'https://calendly.com/Securefit2024',
      booking_brooklyn: 'https://calendly.com/securefit-bk/15-mins',
    });
    expect(BOOKING_LINKS.booking_manhattan).toBe('https://calendly.com/Securefit2024');
  });

  test('accessToken is sent only when a private key is set', () => {
    expect(buildEmailJsBody(config, { a: 1 })).toEqual({
      service_id: 'svc', template_id: 'tpl_renew', user_id: 'pub', template_params: { a: 1 },
    });
    expect(buildEmailJsBody({ ...config, privateKey: 'priv' }, {}).accessToken).toBe('priv');
  });

  test('sendViaEmailJs posts JSON and throws with the status on failure', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    await sendViaEmailJs(config, { to_email: 'x@y.z' }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(EMAILJS_SEND_URL, expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).template_id).toBe('tpl_renew');

    const failing = jest.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'API calls are disabled for non-browser applications' });
    await expect(sendViaEmailJs(config, {}, failing)).rejects.toMatchObject({ status: 403 });
  });

  test('readEmailJsConfig lists missing required settings', () => {
    expect(readEmailJsConfig({}).missing).toEqual([
      'EMAILJS_SERVICE_ID', 'EMAILJS_RENEWAL_TEMPLATE_ID', 'EMAILJS_PUBLIC_KEY',
    ]);
    expect(readEmailJsConfig({
      EMAILJS_SERVICE_ID: 's', EMAILJS_RENEWAL_TEMPLATE_ID: 't', EMAILJS_PUBLIC_KEY: 'p',
    }).missing).toEqual([]);
  });
});

describe('parseArgs and parseServiceAccount', () => {
  test('--dry-run or DRY_RUN=1 turns on dry run', () => {
    expect(parseArgs(['node', 'x'], {})).toEqual({ dryRun: false });
    expect(parseArgs(['node', 'x', '--dry-run'], {})).toEqual({ dryRun: true });
    expect(parseArgs(['node', 'x'], { DRY_RUN: '1' })).toEqual({ dryRun: true });
    expect(parseArgs(['node', 'x'], { DRY_RUN: 'false' })).toEqual({ dryRun: false });
    expect(() => parseArgs(['node', 'x', '--write'], {})).toThrow('Unknown argument');
  });

  test('requires a staging or production service account JSON', () => {
    const good = { client_email: 'a@b', private_key: 'k', project_id: 'fit-test-result-e-card-2026' };
    expect(parseServiceAccount(JSON.stringify(good)).project_id).toBe('fit-test-result-e-card-2026');
    expect(() => parseServiceAccount('')).toThrow('FIREBASE_SERVICE_ACCOUNT');
    expect(() => parseServiceAccount('{not json')).toThrow('not valid JSON');
    expect(() => parseServiceAccount(JSON.stringify({ project_id: 'x' }))).toThrow('missing');
    expect(() => parseServiceAccount(JSON.stringify({ ...good, project_id: 'someone-else' }))).toThrow('Refusing');
  });
});

describe('runReminders', () => {
  const deps = (docs, extra = {}) => ({
    loadOptedIn: jest.fn().mockResolvedValue(docs),
    loadByEmail: jest.fn(async () => []),
    send: jest.fn().mockResolvedValue(undefined),
    markSent: jest.fn().mockResolvedValue(undefined),
    wait: jest.fn().mockResolvedValue(undefined),
    now: NOW,
    log: silent,
    ...extra,
  });

  test('stamps each record before sending with its due year, throttled between sends', async () => {
    const events = [];
    const d = deps([
      { id: 'a', data: record() },
      { id: 'b', data: record({ recipientEmail: 'b@example.com' }) },
      { id: 'c', data: record({ renewalReminderSentFor: 2026, recipientEmail: 'c@example.com' }) },
    ], {
      markSent: jest.fn(async (id, dueYear) => {
        events.push(`mark:${id}:${dueYear}`);
        return true;
      }),
      send: jest.fn(async (params) => {
        events.push(`send:${params.to_email}`);
      }),
    });
    const summary = await runReminders(d);
    expect(events).toEqual([
      'mark:a:2026',
      'send:worker@example.com',
      'mark:b:2026',
      'send:b@example.com',
    ]);
    expect(d.wait).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ sent: 2, failed: 0, eligible: 2, skipped: { 'already-reminded': 1 } });
  });

  test('dry run sends and writes nothing, and logs only masked emails', async () => {
    const lines = [];
    const d = deps([{ id: 'a', data: record() }], { dryRun: true, log: (line) => lines.push(line) });
    const summary = await runReminders(d);
    expect(d.send).not.toHaveBeenCalled();
    expect(d.markSent).not.toHaveBeenCalled();
    expect(summary.wouldSend).toBe(1);
    const output = lines.join('\n');
    expect(output).toContain('w***@e***.com');
    expect(output).not.toContain('worker@example.com');
  });

  test('stops at the per-run cap and leaves the rest for the next run', async () => {
    const docs = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, data: record({ recipientEmail: `w${i}@example.com` }) }));
    const d = deps(docs, { maxSends: 3 });
    const summary = await runReminders(d);
    expect(d.send).toHaveBeenCalledTimes(3);
    expect(summary).toMatchObject({ sent: 3, deferred: 2 });
  });

  test('a worker with a later test on file is not reminded', async () => {
    const d = deps([{ id: 'a', data: record() }], {
      loadByEmail: jest.fn(async () => [{ id: 'z', data: { issueDate: '05/01/2026', deletedAt: null } }]),
    });
    const summary = await runReminders(d);
    expect(d.send).not.toHaveBeenCalled();
    expect(summary.retested).toBe(1);
  });

  test('a failed send keeps the stamp so it is skipped rather than duplicated on rerun, and other sends continue', async () => {
    const send = jest.fn()
      .mockRejectedValueOnce(new EmailJsError(400, 'bad template'))
      .mockResolvedValueOnce(undefined);
    const d = deps([
      { id: 'a', data: record({ issueDate: '12/01/2025' }) },
      { id: 'b', data: record({ recipientEmail: 'b@example.com' }) },
    ], { send });
    const summary = await runReminders(d);
    expect(d.markSent.mock.calls).toEqual([['a', 2026], ['b', 2026]]);
    expect(summary).toMatchObject({ sent: 1, failed: 1 });

    // Next day's run sees renewalReminderSentFor: 2026 on `a` and skips it.
    const rerun = deps([{ id: 'a', data: record({ issueDate: '12/01/2025', renewalReminderSentFor: 2026 }) }]);
    const rerunSummary = await runReminders(rerun);
    expect(rerun.send).not.toHaveBeenCalled();
    expect(rerunSummary).toMatchObject({ sent: 0, skipped: { 'already-reminded': 1 } });
  });

  test('a 429 from EmailJS stops the run', async () => {
    const send = jest.fn().mockRejectedValue(new EmailJsError(429, 'Too many requests'));
    const d = deps([
      { id: 'a', data: record({ issueDate: '12/01/2025' }) },
      { id: 'b', data: record({ recipientEmail: 'b@example.com' }) },
    ], { send });
    const summary = await runReminders(d);
    expect(send).toHaveBeenCalledTimes(1);
    expect(summary.failed).toBe(1);
  });

  test('a failed transaction stamp counts as a failure and skips sending the email', async () => {
    const d = deps([{ id: 'a', data: record() }], {
      markSent: jest.fn().mockRejectedValue(new Error('PERMISSION_DENIED')),
    });
    const summary = await runReminders(d);
    expect(d.send).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ sent: 0, failed: 1 });
  });

  test('skips sending when the transaction sees the record was already stamped', async () => {
    const d = deps([{ id: 'a', data: record() }], {
      markSent: jest.fn().mockResolvedValue(false),
    });
    const summary = await runReminders(d);
    expect(d.send).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ sent: 0, failed: 0, skipped: { 'already-reminded': 1 } });
  });

  test('a recipient the run does not allow (staging) is skipped and not sent', async () => {
    const d = deps([
      { id: 'a', data: record({ recipientEmail: 'real.person@customer.org' }) },
      { id: 'b', data: record({ recipientEmail: 'qa@example.com' }) },
    ], { allowRecipient: (email) => STAGING_RECIPIENT.test(email) });
    const summary = await runReminders(d);
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(d.send.mock.calls[0][0].to_email).toBe('qa@example.com');
    expect(summary.skipped['staging-recipient']).toBe(1);
  });
});

describe('claimReminderStamp', () => {
  const makeHarness = (docData, exists = true) => {
    const ref = { id: 'ft-1' };
    const fitTests = { doc: jest.fn(() => ref) };
    const tx = {
      get: jest.fn(async () => ({ exists, data: () => docData })),
      update: jest.fn(),
    };
    const db = {
      runTransaction: jest.fn(async (fn) => fn(tx)),
    };
    const serverTimestamp = jest.fn(() => 'SERVER_TS');
    return { ref, fitTests, tx, db, serverTimestamp };
  };

  test('reads doc, checks dueYear, and writes stamp inside a transaction when unset', async () => {
    const h = makeHarness({ renewalReminderOptIn: true, deletedAt: null });
    const markSent = claimReminderStamp({ db: h.db, fitTests: h.fitTests, serverTimestamp: h.serverTimestamp });
    const claimed = await markSent('ft-1', 2026);
    expect(claimed).toBe(true);
    expect(h.db.runTransaction).toHaveBeenCalledTimes(1);
    expect(h.tx.get).toHaveBeenCalledWith(h.ref);
    expect(h.tx.update).toHaveBeenCalledWith(h.ref, {
      renewalReminderSentFor: 2026,
      renewalReminderSentAt: 'SERVER_TS',
    });
  });

  test.each([
    ['already stamped for this year', { renewalReminderOptIn: true, deletedAt: null, renewalReminderSentFor: 2026 }, true],
    ['soft deleted', { renewalReminderOptIn: true, deletedAt: { seconds: 1 } }, true],
    ['not opted in', { renewalReminderOptIn: false, deletedAt: null }, true],
    ['missing document', null, false],
  ])('returns false without writing when %s', async (_label, data, exists) => {
    const h = makeHarness(data, exists);
    const markSent = claimReminderStamp({ db: h.db, fitTests: h.fitTests, serverTimestamp: h.serverTimestamp });
    const claimed = await markSent('ft-1', 2026);
    expect(claimed).toBe(false);
    expect(h.tx.update).not.toHaveBeenCalled();
  });
});
