import {
  HELEN_FONG_SCHOOL_NAME,
  PROD_PROJECT_ID,
  STAGING_PROJECT_ID,
  assertAllowedProject,
  planHelenFongWrite,
} from '../../scripts/add-helen-fong-school';

test('Helen Fong is planned through the same school and directory shape as addMasterSchool', () => {
  const plan = planHelenFongWrite({
    names: ['Helene College of Nursing'],
    programs: [{
      name: 'Helene College of Nursing',
      programAdministratorName: 'Pat',
      programAdministratorContact: 'pat@example.com',
    }],
  });

  expect(HELEN_FONG_SCHOOL_NAME).toBe('Helen Fong');
  expect(plan.alreadyPresent).toBe(false);
  expect(plan.school).toEqual({
    name: 'Helen Fong',
    programAdministratorName: '',
    programAdministratorContact: '',
  });
  expect(plan.names).toEqual(['Helen Fong', 'Helene College of Nursing']);
  expect(plan.programs).toEqual([
    {
      name: 'Helen Fong',
      programAdministratorName: '',
      programAdministratorContact: '',
    },
    {
      name: 'Helene College of Nursing',
      programAdministratorName: 'Pat',
      programAdministratorContact: 'pat@example.com',
    },
  ]);
  expect(planHelenFongWrite({
    names: ['Helen Fong'],
    schoolExists: false,
  }).alreadyPresent).toBe(true);
});

test('the Helen Fong script refuses every project except staging', () => {
  expect(assertAllowedProject(STAGING_PROJECT_ID)).toBe(STAGING_PROJECT_ID);
  expect(() => assertAllowedProject(PROD_PROJECT_ID)).toThrow(/production project/);
  expect(() => assertAllowedProject('some-other-project')).toThrow(/Refusing to add a school/);
});
