import { getVerifyTokenFromPath } from './verificationToken';

export const STAFF_LOGIN_PATH = '/staff_login';
export const RESEND_PATH = '/resend';

export const normalizePathname = (pathname = '/') =>
  pathname.replace(/\/+$/, '') || '/';

export const getPublicPath = () => {
  if (typeof window === 'undefined') return '/';
  return normalizePathname(window.location.pathname);
};

/**
 * Resolve the public URL into a tagged route object.
 * Staff pages after login stay in memory (`currentPage`) and are not URL-backed.
 */
export const resolveAppRoute = (pathname) => {
  const path = normalizePathname(pathname ?? getPublicPath());

  if (path === STAFF_LOGIN_PATH) {
    return { kind: 'staff', path };
  }
  if (path === RESEND_PATH) {
    return { kind: 'resend', path };
  }

  const token = getVerifyTokenFromPath(path);
  if (token !== null) {
    return { kind: 'verify', path, token };
  }

  return { kind: 'home', path };
};
