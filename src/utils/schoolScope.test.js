import {
  filterUsersForActor,
  isAdminWithinSchools,
  isTesterInSchools,
  parseSchoolListInput,
} from './schoolScope';

const HELENE = 'Helene College of Nursing';
const SECOND = 'Example Second School';

const tester = (id, school) => ({
  id,
  role: 'tester',
  school,
});

const admin = (id, schools) => ({
  id,
  role: 'admin',
  schools,
});

const USERS = [
  { id: 'super-1', role: 'superadmin', schools: [HELENE, SECOND] },
  admin('admin-wide', [HELENE, SECOND]),
  admin('admin-helene', [HELENE]),
  tester('tester-helene', HELENE),
  tester('tester-second', SECOND),
  tester('tester-blank', ''),
  { id: 'legacy-tester', role: 'tester' },
];

test('a tester is visible only when their school is in the list', () => {
  expect(isTesterInSchools([HELENE], tester('t', HELENE))).toBe(true);
  expect(isTesterInSchools([HELENE], tester('t', SECOND))).toBe(false);
  expect(isTesterInSchools([HELENE], tester('t', ''))).toBe(false);
  expect(isTesterInSchools([HELENE], { id: 't' })).toBe(false);
  expect(isTesterInSchools([HELENE], admin('a', [HELENE]))).toBe(false);
});

test('an admin is visible only when every school is inside the actor list', () => {
  expect(isAdminWithinSchools([HELENE, SECOND], admin('a', [HELENE]))).toBe(true);
  expect(isAdminWithinSchools([HELENE], admin('a', [HELENE, SECOND]))).toBe(false);
  expect(isAdminWithinSchools([HELENE], admin('a', []))).toBe(false);
  expect(isAdminWithinSchools([HELENE], tester('t', HELENE))).toBe(false);
});

test('a scoped admin sees only users in their schools, and a super admin sees everyone', () => {
  const scoped = filterUsersForActor(
    { uid: 'admin-helene', role: 'admin', schools: [HELENE] },
    USERS,
  ).map((user) => user.id);

  expect(scoped).toEqual(['admin-helene', 'tester-helene']);

  expect(filterUsersForActor(
    { uid: 'super-1', role: 'superadmin', schools: [] },
    USERS,
  )).toHaveLength(USERS.length);

  expect(filterUsersForActor(
    { uid: 'tester-helene', role: 'tester', schools: [] },
    USERS,
  )).toEqual([]);
});

test('a scoped admin still sees their own profile when it has no schools', () => {
  const users = [admin('admin-1', [])];
  expect(filterUsersForActor(
    { uid: 'admin-1', role: 'admin', schools: [] },
    users,
  ).map((user) => user.id)).toEqual(['admin-1']);
});

test('school tag input splits on commas and drops blanks', () => {
  expect(parseSchoolListInput(` ${HELENE}, ${SECOND}, ,`)).toEqual([HELENE, SECOND]);
  expect(parseSchoolListInput('')).toEqual([]);
});
