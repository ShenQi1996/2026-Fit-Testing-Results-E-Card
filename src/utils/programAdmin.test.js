import { programAdminForSchool, readProgramAdmin } from './programAdmin';

test('a selected school supplies program administrator fields', () => {
  expect(programAdminForSchool({
    name: 'Helen Fong',
    programAdministratorName: 'Ada Admin',
    programAdministratorContact: 'ada@example.com',
  }, {
    programAdministratorName: 'Tess Tester',
    programAdministratorContact: 'tess@example.com',
  })).toEqual({
    programAdministratorName: 'Ada Admin',
    programAdministratorContact: 'ada@example.com',
  });
});

test('a blank school field falls back to the user, and blanks stay blank', () => {
  expect(programAdminForSchool({
    programAdministratorName: '  ',
    programAdministratorContact: 'school@example.com',
  }, {
    programAdministratorName: ' Tess Tester ',
    programAdministratorContact: '',
  })).toEqual({
    programAdministratorName: 'Tess Tester',
    programAdministratorContact: 'school@example.com',
  });

  expect(programAdminForSchool(null, {})).toEqual({
    programAdministratorName: '',
    programAdministratorContact: '',
  });
  expect(readProgramAdmin({ programAdministratorName: 12 })).toEqual({
    programAdministratorName: '',
    programAdministratorContact: '',
  });
});
