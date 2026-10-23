import {
  createVerificationToken,
  getVerifyTokenFromPath,
  getVerifyUrl,
  isValidVerificationToken,
  normalizeVerificationToken,
  VERIFY_PATH,
} from './verificationToken';

describe('verification tokens', () => {
  test('createVerificationToken returns 32 hex characters', () => {
    const token = createVerificationToken();
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    expect(isValidVerificationToken(token)).toBe(true);
  });

  test('token checks trim, lowercase, and reject malformed values', () => {
    expect(normalizeVerificationToken('  AbCDef0123456789abcdef0123456789  ')).toBe(
      'abcdef0123456789abcdef0123456789'
    );
    expect(isValidVerificationToken('ABCDEF0123456789ABCDEF0123456789')).toBe(true);
    expect(isValidVerificationToken('abc')).toBe(false);
    expect(isValidVerificationToken('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
    expect(isValidVerificationToken('')).toBe(false);
  });

  test('verify URLs and paths keep only a real token', () => {
    const token = 'abcdef0123456789abcdef0123456789';

    expect(getVerifyUrl(`  ${token.toUpperCase()}  `)).toBe(
      `https://2026-fit-testing-results-e-card.vercel.app${VERIFY_PATH}/${token}`
    );
    expect(getVerifyUrl('nope')).toBe(
      `https://2026-fit-testing-results-e-card.vercel.app${VERIFY_PATH}`
    );
    expect(getVerifyTokenFromPath(`${VERIFY_PATH}/${token}`)).toBe(token);
    expect(getVerifyTokenFromPath(`${VERIFY_PATH}/`)).toBe('');
    expect(getVerifyTokenFromPath('/resend')).toBeNull();
  });
});
