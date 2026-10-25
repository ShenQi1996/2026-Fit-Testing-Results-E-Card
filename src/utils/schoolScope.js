import {
  isAdminOrAbove,
  isSuperAdmin,
  USER_ROLE_ADMIN,
  USER_ROLE_FACULTY,
  USER_ROLE_TESTER,
} from './roles';

/** School names stored on a user document. Blank entries are dropped. */
export const normalizeSchoolList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseSchoolListInput = (value) => normalizeSchoolList(String(value || '').split(','));

const schoolName = (user) => (
  typeof user?.school === 'string' ? user.school.trim() : ''
);

/** Tester `school` is one of the actor's schools. */
export const isTesterInSchools = (actorSchools, user) => {
  const schools = normalizeSchoolList(actorSchools);
  const role = user?.role || USER_ROLE_TESTER;
  if (role !== USER_ROLE_TESTER) return false;
  const school = schoolName(user);
  return school !== '' && schools.includes(school);
};

/** Faculty use the same single `school` string as testers. */
export const isFacultyInSchools = (actorSchools, user) => {
  const schools = normalizeSchoolList(actorSchools);
  if (user?.role !== USER_ROLE_FACULTY) return false;
  const school = schoolName(user);
  return school !== '' && schools.includes(school);
};

/**
 * Admin `schools` must be a non-empty subset of the actor's schools.
 * One school outside the actor's list is enough to hide the admin.
 */
export const isAdminWithinSchools = (actorSchools, user) => {
  if (user?.role !== USER_ROLE_ADMIN) return false;
  const schools = normalizeSchoolList(actorSchools);
  const targetSchools = normalizeSchoolList(user?.schools);
  return targetSchools.length > 0 && targetSchools.every((school) => schools.includes(school));
};

/**
 * Super admins see every user. A scoped admin sees their own profile,
 * testers and faculty in their schools, and admins whose schools sit inside that list.
 */
export const filterUsersForActor = (actor, users) => {
  if (!Array.isArray(users)) return [];
  if (isSuperAdmin(actor?.role)) return users;
  if (!isAdminOrAbove(actor)) return [];
  return users.filter((user) => (
    user?.id === actor?.uid
    || isTesterInSchools(actor?.schools, user)
    || isFacultyInSchools(actor?.schools, user)
    || isAdminWithinSchools(actor?.schools, user)
  ));
};
