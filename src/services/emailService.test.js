import emailjs from '@emailjs/browser';
import { assertStagingRecipient, sendFitTestCard } from './emailService';

const STAGING_REFUSAL = /Staging does not email real customers/;

const BYPASS_RECIPIENTS = [
  'a@evil.com,b@example.com',
  'a@evil.com; b@example.com',
  'x@evil.com?@example.com',
  '"a@evil.com"@example.com',
];

test('staging email accepts exactly one example.com address', () => {
  expect(assertStagingRecipient('person@example.com', 'staging')).toBe('person@example.com');
  expect(assertStagingRecipient(' Person@Example.com ', 'staging')).toBe('Person@Example.com');
  expect(assertStagingRecipient('test-person-01@example.com', 'staging')).toBe(
    'test-person-01@example.com'
  );
});

test('staging email rejects addresses that only look like example.com', () => {
  BYPASS_RECIPIENTS.forEach((email) => {
    expect(() => assertStagingRecipient(email, 'staging')).toThrow(STAGING_REFUSAL);
    expect(() => assertStagingRecipient(`  ${email}  `, 'staging')).toThrow(STAGING_REFUSAL);
  });
  expect(() => assertStagingRecipient('customer@securefit.example', 'staging')).toThrow(STAGING_REFUSAL);
  expect(() => assertStagingRecipient('securefit2024+test_tester@gmail.com', 'staging')).toThrow(
    STAGING_REFUSAL
  );
  expect(() => assertStagingRecipient('', 'staging')).toThrow(STAGING_REFUSAL);
});

test('production email is not blocked by the staging recipient guard', () => {
  const saved = process.env.APP_ENV;
  delete process.env.APP_ENV;
  try {
    expect(assertStagingRecipient('customer@example.org')).toBe('customer@example.org');
    expect(assertStagingRecipient('customer@example.org', '')).toBe('customer@example.org');
    expect(assertStagingRecipient('customer@example.org', 'production')).toBe('customer@example.org');
    BYPASS_RECIPIENTS.forEach((email) => {
      expect(assertStagingRecipient(email, 'production')).toBe(email);
      expect(assertStagingRecipient(` ${email} `, undefined)).toBe(email);
    });
  } finally {
    if (saved === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = saved;
  }
});

test('staging sends EmailJS the same single address it validated', async () => {
  const saved = process.env.APP_ENV;
  process.env.APP_ENV = 'staging';
  const send = jest.spyOn(emailjs, 'send').mockResolvedValue({ status: 200, text: 'OK' });
  try {
    await sendFitTestCard({
      recipientEmail: ' Person@Example.com ',
      clientName: 'Test Person',
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][2]).toEqual(expect.objectContaining({
      to_email: 'Person@Example.com',
      reply_to: 'Person@Example.com',
    }));

    send.mockClear();
    await expect(sendFitTestCard({
      recipientEmail: 'a@evil.com,b@example.com',
    })).rejects.toThrow(STAGING_REFUSAL);
    expect(send).not.toHaveBeenCalled();
  } finally {
    send.mockRestore();
    if (saved === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = saved;
  }
});
