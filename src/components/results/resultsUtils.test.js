import { getEcardFormDataFromTest } from './resultsUtils';

test('an in-app resend carries the program administrator fields on the record', () => {
  const formData = getEcardFormDataFromTest({
    clientName: 'Ada Lovelace',
    recipientEmail: 'ada@example.com',
    programAdministratorName: 'Ada Admin',
    programAdministratorContact: 'ada-admin@example.com',
  });
  expect(formData).toEqual(expect.objectContaining({
    programAdministratorName: 'Ada Admin',
    programAdministratorContact: 'ada-admin@example.com',
  }));

  expect(getEcardFormDataFromTest({ clientName: 'Legacy' })).toEqual(expect.objectContaining({
    programAdministratorName: '',
    programAdministratorContact: '',
  }));
});
