const PRODUCTION_ORIGIN = 'https://2026-fit-testing-results-e-card.vercel.app';

export const VERIFY_PATH = '/verify';
export const VERIFICATION_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

const bytesToHex = (bytes) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * 128-bit random token. Unguessable, so public get-by-id cannot be scraped by ID.
 * @returns {string}
 */
export const createVerificationToken = () => {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
};

export const normalizeVerificationToken = (token = '') => token.trim().toLowerCase();

export const isValidVerificationToken = (token) =>
  VERIFICATION_TOKEN_PATTERN.test(normalizeVerificationToken(token));

export const getAppOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return PRODUCTION_ORIGIN;
};

export const getVerifyUrl = (token) => {
  const origin = getAppOrigin();
  if (!isValidVerificationToken(token)) {
    return `${origin}${VERIFY_PATH}`;
  }
  return `${origin}${VERIFY_PATH}/${normalizeVerificationToken(token)}`;
};

/**
 * @param {string} pathname
 * @returns {string|null} Token string (possibly empty) when this is a verify URL; otherwise null.
 */
export const getVerifyTokenFromPath = (pathname = '') => {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === VERIFY_PATH) return '';
  if (path.startsWith(`${VERIFY_PATH}/`)) {
    return path.slice(VERIFY_PATH.length + 1);
  }
  return null;
};
