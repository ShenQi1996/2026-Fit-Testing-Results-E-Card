export const USER_ROLE_TESTER = 'tester';
export const USER_ROLE_ADMIN = 'admin';
export const USER_ROLE_SUPERADMIN = 'superadmin';

export const USER_ROLES = [
  USER_ROLE_TESTER,
  USER_ROLE_ADMIN,
  USER_ROLE_SUPERADMIN,
];

export const isSuperAdminRole = (role) => role === USER_ROLE_SUPERADMIN;

export const isStaffAdminRole = (role) => (
  role === USER_ROLE_ADMIN || role === USER_ROLE_SUPERADMIN
);

/** Role values a signed-in manager may assign. Regular admins only assign tester. */
export const rolesAssignableBy = (actorRole) => (
  isSuperAdminRole(actorRole) ? USER_ROLES : [USER_ROLE_TESTER]
);

/**
 * Regular admins may change tester profiles only.
 * Super admins may change any profile.
 */
export const canModifyManagedUser = (actorRole, targetRole) => {
  if (!isStaffAdminRole(actorRole)) return false;
  if (isSuperAdminRole(actorRole)) return true;
  return (targetRole || USER_ROLE_TESTER) === USER_ROLE_TESTER;
};
