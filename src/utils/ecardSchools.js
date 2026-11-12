import { isFaculty, isSuperAdmin, USER_ROLE_ADMIN, USER_ROLE_TESTER } from './roles';
import { normalizeSchoolList } from './schoolScope';

export const NO_ASSIGNED_SCHOOL_MESSAGE = 'You have no school assigned, so you cannot send an e-card.';

export const SELECT_SCHOOL_MESSAGE = 'Select a school before sending this e-card.';

const testerSchool = (user) => (
  typeof user?.school === 'string' ? user.school.trim() : ''
);

/** Schools the signed-in user may put on a fit test. Super admins use the master list. */
export const schoolsForSignedInUser = (user, masterSchools = []) => {
  if (isFaculty(user)) return [];
  if (isSuperAdmin(user?.role)) return normalizeSchoolList(masterSchools);
  if (user?.role === USER_ROLE_ADMIN) return normalizeSchoolList(user?.schools);
  const school = testerSchool(user);
  return school ? [school] : [];
};

/**
 * Display next to Account Role.
 * Testers show `school`, admins show `schools` joined with ", ", super admins show All.
 */
export const accountSchoolLabel = (user) => {
  if (isSuperAdmin(user?.role)) return 'All';
  if (user?.role === USER_ROLE_ADMIN) {
    const names = normalizeSchoolList(user?.schools);
    return names.length ? names.join(', ') : '—';
  }
  return testerSchool(user) || '—';
};

export const ecardSchoolChoices = (user, masterSchools = []) => {
  const options = schoolsForSignedInUser(user, masterSchools);
  const role = user?.role || USER_ROLE_TESTER;
  const locked = !isSuperAdmin(role) && (role !== USER_ROLE_ADMIN || options.length <= 1);
  return {
    options,
    locked,
    blockedMessage: options.length === 0 ? NO_ASSIGNED_SCHOOL_MESSAGE : '',
  };
};
