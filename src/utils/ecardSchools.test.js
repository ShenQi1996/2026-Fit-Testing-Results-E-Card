import {
  NO_ASSIGNED_SCHOOL_MESSAGE,
  SELECT_SCHOOL_MESSAGE,
  accountSchoolLabel,
  ecardSchoolChoices,
  schoolsForSignedInUser,
} from './ecardSchools';

const HELENE = 'Helene College of Nursing';
const SECOND = 'Example Second School';
const MASTER = [HELENE, SECOND];

test('a tester is limited to their single school', () => {
  const user = { role: 'tester', school: HELENE, schools: [SECOND] };
  const choice = ecardSchoolChoices(user, MASTER);

  expect(schoolsForSignedInUser(user, MASTER)).toEqual([HELENE]);
  expect(choice.options).toEqual([HELENE]);
  expect(choice.locked).toBe(true);
  expect(choice.blockedMessage).toBe('');
  expect(accountSchoolLabel(user)).toBe(HELENE);
});

test('an admin uses their schools array and locks a single school', () => {
  const several = { role: 'admin', schools: [SECOND, HELENE], school: 'Ignored' };
  const one = { role: 'admin', schools: [HELENE] };

  expect(ecardSchoolChoices(several, MASTER)).toEqual({
    options: [SECOND, HELENE],
    locked: false,
    blockedMessage: '',
  });
  expect(ecardSchoolChoices(one, MASTER).locked).toBe(true);
  expect(ecardSchoolChoices(one, MASTER).options).toEqual([HELENE]);
  expect(accountSchoolLabel(several)).toBe(`${SECOND}, ${HELENE}`);
});

test('faculty cannot send an e-card', () => {
  const user = { role: 'faculty', school: HELENE, schools: [SECOND] };
  expect(schoolsForSignedInUser(user, MASTER)).toEqual([]);
  expect(ecardSchoolChoices(user, MASTER).blockedMessage).toBe(NO_ASSIGNED_SCHOOL_MESSAGE);
  expect(accountSchoolLabel(user)).toBe(HELENE);
});

test('a super admin uses the master list', () => {
  const user = { role: 'superadmin', school: HELENE, schools: [HELENE] };

  expect(ecardSchoolChoices(user, MASTER)).toEqual({
    options: MASTER,
    locked: false,
    blockedMessage: '',
  });
  expect(accountSchoolLabel(user)).toBe('All');
});

test('a user with no school is blocked', () => {
  expect(ecardSchoolChoices({ role: 'tester', school: '  ' }, MASTER)).toMatchObject({
    options: [],
    locked: true,
    blockedMessage: NO_ASSIGNED_SCHOOL_MESSAGE,
  });
  expect(ecardSchoolChoices({ role: 'admin', schools: [] }, MASTER).blockedMessage)
    .toBe(NO_ASSIGNED_SCHOOL_MESSAGE);
  expect(ecardSchoolChoices({ role: 'superadmin' }, []).blockedMessage)
    .toBe(NO_ASSIGNED_SCHOOL_MESSAGE);
  expect(accountSchoolLabel({ role: 'tester' })).toBe('—');
  expect(accountSchoolLabel({ role: 'admin', schools: ['', '  '] })).toBe('—');
  expect(SELECT_SCHOOL_MESSAGE).toMatch(/Select a school/);
});
