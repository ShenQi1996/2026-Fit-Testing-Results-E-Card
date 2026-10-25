export const USER_ROLE_TESTER = 'tester';
export const USER_ROLE_FACULTY = 'faculty';
export const USER_ROLE_ADMIN = 'admin';
export const USER_ROLE_SUPERADMIN = 'superadmin';

export const USER_ROLES = [
  USER_ROLE_TESTER,
  USER_ROLE_FACULTY,
  USER_ROLE_ADMIN,
  USER_ROLE_SUPERADMIN,
];

export const isSuperAdmin = (role) => role === USER_ROLE_SUPERADMIN;

const parseAccessInstant = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Admin and faculty access window. A missing start or end leaves that side open.
 * Super admins and other roles are always open. A string role has no dates.
 */
export const isAccessWindowOpen = (user, now = new Date()) => {
  if (!user || typeof user !== 'object') return true;
  if (user.role === USER_ROLE_SUPERADMIN) return true;
  if (user.role !== USER_ROLE_ADMIN && user.role !== USER_ROLE_FACULTY) return true;
  const start = parseAccessInstant(user.startDate);
  const end = parseAccessInstant(user.endDate);
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

const roleOf = (userOrRole) => (
  typeof userOrRole === 'string' ? userOrRole : userOrRole?.role
);

/** Faculty see school-scoped results and are not admins. */
export const isFaculty = (userOrRole) => roleOf(userOrRole) === USER_ROLE_FACULTY;

/**
 * Admin screens and admin checks. A super admin is included.
 * A role string is unchanged. A user object also has to be inside its window.
 */
export const isAdminOrAbove = (userOrRole, now = new Date()) => {
  const role = roleOf(userOrRole);
  if (role !== USER_ROLE_ADMIN && role !== USER_ROLE_SUPERADMIN) return false;
  if (typeof userOrRole !== 'object' || userOrRole === null) return true;
  return isAccessWindowOpen(userOrRole, now);
};

/** Calendar day from a timestamp, ISO string, or Date. Empty when missing. */
export const accessDateInputValue = (value) => {
  const date = parseAccessInstant(value);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Local start or end of a YYYY-MM-DD day. Null when the day is not real. */
export const accessBoundaryDate = (value, edge) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = edge === 'end'
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

/** Empty when either side is blank or the end day is on or after the start day. */
export const accessWindowOrderError = (startDate, endDate) => {
  const start = String(startDate || '');
  const end = String(endDate || '');
  if (start && end && end < start) {
    return 'Access end date cannot be before the start date.';
  }
  return '';
};

/**
 * Rules lock the account when endDate is present and request.time is after it.
 * The end instant itself is still allowed (`request.time <= endDate`).
 * A missing end leaves that side open. A present value that is not a time
 * fails the rules' timestamp check.
 */
export const accessEndLocksAccount = (endDate, now = new Date()) => {
  if (endDate == null || endDate === '') return false;
  const end = parseAccessInstant(endDate);
  if (!end) return true;
  return now.getTime() > end.getTime();
};

const STATUS_PILL_LABELS = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
};

/**
 * Label for the Manage Users status pill. Display only: an approved account
 * whose end timestamp is before now reads Expired, matching endAllows in
 * firestore.rules. Nothing is written back.
 */
export const accountStatusLabel = (user, now = new Date()) => {
  const status = String(user?.status || 'pending').toLowerCase();
  if (
    status === 'approved'
    && user?.role !== USER_ROLE_SUPERADMIN
    && accessEndLocksAccount(user?.endDate, now)
  ) {
    return { label: 'Expired', statusClass: 'status-expired' };
  }
  const label = STATUS_PILL_LABELS[status]
    || (status.charAt(0).toUpperCase() + status.slice(1));
  return { label, statusClass: `status-${status}` };
};

/**
 * Roles a manager may set on an existing user from the client.
 * Never superadmin. A plain admin may set tester or faculty. A super admin
 * may set tester, faculty, or admin.
 */
export const rolesAssignableBy = (actorRole) => {
  if (isSuperAdmin(actorRole)) return [USER_ROLE_TESTER, USER_ROLE_FACULTY, USER_ROLE_ADMIN];
  if (actorRole === USER_ROLE_ADMIN) return [USER_ROLE_TESTER, USER_ROLE_FACULTY];
  return [USER_ROLE_TESTER];
};

/** Roles that may be written on a new user document. Never superadmin. */
export const rolesCreatableBy = (actorRole) => {
  if (isSuperAdmin(actorRole)) return [USER_ROLE_TESTER, USER_ROLE_FACULTY, USER_ROLE_ADMIN];
  if (actorRole === USER_ROLE_ADMIN) return [USER_ROLE_TESTER, USER_ROLE_FACULTY];
  return [USER_ROLE_TESTER];
};

/**
 * Regular admins may change tester and faculty profiles only.
 * Super admins may change any profile. Faculty cannot manage users.
 */
export const canModifyManagedUser = (actorRole, targetRole) => {
  if (!isAdminOrAbove(actorRole)) return false;
  if (isSuperAdmin(actorRole)) return true;
  const target = targetRole || USER_ROLE_TESTER;
  return target === USER_ROLE_TESTER || target === USER_ROLE_FACULTY;
};
