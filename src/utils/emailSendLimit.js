export const RATE_LIMITED_SENDER_EMAILS = [
  'securefit2024+test_tester@gmail.com',
  'securefit2024+test_admin@gmail.com',
];

export const STAFF_SEND_WINDOW_HOURS = 24;

const WINDOW_MS = STAFF_SEND_WINDOW_HOURS * 60 * 60 * 1000;

export const normalizeSenderEmail = (email = '') => String(email).trim().toLowerCase();

export const isRateLimitedSender = (email) =>
  RATE_LIMITED_SENDER_EMAILS.includes(normalizeSenderEmail(email));

/**
 * Rolling 24-hour cap for the two test staff accounts. Everyone else is allowed.
 * @param {{ senderEmail?: string, lastSentAt?: Date|string|number|null, now?: Date }} input
 * @returns {{ allowed: boolean, retryAt: Date|null }}
 */
export const evaluateStaffSendLimit = ({
  senderEmail,
  lastSentAt = null,
  now = new Date(),
} = {}) => {
  if (!isRateLimitedSender(senderEmail)) {
    return { allowed: true, retryAt: null };
  }

  if (!lastSentAt) {
    return { allowed: true, retryAt: null };
  }

  const sentAt = lastSentAt instanceof Date ? lastSentAt : new Date(lastSentAt);
  if (Number.isNaN(sentAt.getTime())) {
    return { allowed: true, retryAt: null };
  }

  const retryAt = new Date(sentAt.getTime() + WINDOW_MS);
  if (now.getTime() < retryAt.getTime()) {
    return { allowed: false, retryAt };
  }

  return { allowed: true, retryAt: null };
};

export const formatStaffSendLimitMessage = (retryAt) => {
  const when = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(retryAt);
  return `This account can send 1 e-card every 24 hours. You can send again on ${when} UTC.`;
};
