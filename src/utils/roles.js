export const USER_ROLE_TESTER = 'tester';
export const USER_ROLE_ADMIN = 'admin';
export const USER_ROLE_SUPERADMIN = 'superadmin';

export const USER_ROLES = [
  USER_ROLE_TESTER,
  USER_ROLE_ADMIN,
  USER_ROLE_SUPERADMIN,
];

export const isSuperAdmin = (role) => role === USER_ROLE_SUPERADMIN;

/** Admin screens and admin checks. A super admin is included. */
export const isAdminOrAbove = (role) => (
  role === USER_ROLE_ADMIN || role === USER_ROLE_SUPERADMIN
);

/**
 * Roles a manager may set on an existing user.
 * A plain admin only keeps tester. A super admin may change role to or from
 * admin or superadmin. Creating a superadmin document is a separate ban.
 */
export const rolesAssignableBy = (actorRole) => (
  isSuperAdmin(actorRole) ? USER_ROLES : [USER_ROLE_TESTER]
);

/** Roles that may be written on a new user document. Never superadmin. */
export const rolesCreatableBy = (actorRole) => (
  isSuperAdmin(actorRole)
    ? [USER_ROLE_TESTER, USER_ROLE_ADMIN]
    : [USER_ROLE_TESTER]
);

/**
 * Regular admins may change tester profiles only.
 * Super admins may change any profile.
 */
export const canModifyManagedUser = (actorRole, targetRole) => {
  if (!isAdminOrAbove(actorRole)) return false;
  if (isSuperAdmin(actorRole)) return true;
  return (targetRole || USER_ROLE_TESTER) === USER_ROLE_TESTER;
};
