import { parseDateString } from './dateUtils';

/**
 * Normalize a client name so "Jane  Smith" and "jane smith" share a lookup key.
 * @param {string} name
 * @returns {string}
 */
export const normalizeClientName = (name = '') =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Normalize DOB to MM/DD/YYYY digits-with-slashes, or empty if incomplete.
 * @param {string} dob
 * @returns {string}
 */
export const normalizeDob = (dob = '') => {
  const trimmed = dob.trim();
  if (!parseDateString(trimmed) || trimmed.length !== 10) return '';
  return trimmed;
};

/**
 * Normalize an email for matching so casing and stray spaces do not matter.
 * @param {string} email
 * @returns {string}
 */
export const normalizeEmail = (email = '') => email.trim().toLowerCase();

const bytesToHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/**
 * SHA-256 hex key from name + DOB + email. Empty if any value is missing/invalid.
 * Document ID for public resend lookups — guests must know all three values,
 * so a record cannot even be fetched without the email on file.
 * @param {string} clientName
 * @param {string} dob
 * @param {string} recipientEmail
 * @returns {Promise<string>}
 */
export const buildLookupKey = async (clientName, dob, recipientEmail) => {
  const name = normalizeClientName(clientName);
  const birthDate = normalizeDob(dob);
  const email = normalizeEmail(recipientEmail);
  if (!name || !birthDate || !email) return '';

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Secure lookup is not available in this browser.');
  }

  const payload = `${name}|${birthDate}|${email}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return bytesToHex(digest);
};
