import {
  evaluateStaffSendLimit,
  formatStaffSendLimitMessage,
  isRateLimitedSender,
  STAFF_SEND_WINDOW_HOURS,
} from './emailSendLimit';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-10-23T12:00:00.000Z');

describe('staff send limit', () => {
  test('blocks a limited account inside the rolling 24 hour window', () => {
    const lastSentAt = new Date(now.getTime() - (STAFF_SEND_WINDOW_HOURS * HOUR_MS) + 60 * 1000);
    const decision = evaluateStaffSendLimit({
      senderEmail: 'securefit2024+test_tester@gmail.com',
      lastSentAt,
      now,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.retryAt).toEqual(new Date(lastSentAt.getTime() + STAFF_SEND_WINDOW_HOURS * HOUR_MS));
    expect(formatStaffSendLimitMessage(decision.retryAt)).toMatch(/You can send again on/);
  });

  test('allows a limited account once 24 hours have passed', () => {
    const lastSentAt = new Date(now.getTime() - STAFF_SEND_WINDOW_HOURS * HOUR_MS);
    const decision = evaluateStaffSendLimit({
      senderEmail: 'securefit2024+test_admin@gmail.com',
      lastSentAt,
      now,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.retryAt).toBeNull();
  });

  test('never blocks accounts that are not on the limited list', () => {
    const lastSentAt = new Date(now.getTime() - 5 * 60 * 1000);

    expect(evaluateStaffSendLimit({
      senderEmail: 'sam.qi@example.com',
      lastSentAt,
      now,
    })).toEqual({ allowed: true, retryAt: null });

    expect(evaluateStaffSendLimit({
      senderEmail: 'securefit2024@gmail.com',
      lastSentAt,
      now,
    }).allowed).toBe(true);

    expect(isRateLimitedSender('person@example.com')).toBe(false);
  });

  test('matches limited sender emails without caring about case or surrounding spaces', () => {
    const lastSentAt = new Date(now.getTime() - HOUR_MS);

    expect(isRateLimitedSender('  SecureFit2024+Test_Tester@Gmail.com  ')).toBe(true);
    expect(isRateLimitedSender('SECUREFIT2024+TEST_ADMIN@GMAIL.COM')).toBe(true);

    const decision = evaluateStaffSendLimit({
      senderEmail: 'SecureFit2024+Test_Admin@Gmail.com',
      lastSentAt,
      now,
    });
    expect(decision.allowed).toBe(false);
  });
});
