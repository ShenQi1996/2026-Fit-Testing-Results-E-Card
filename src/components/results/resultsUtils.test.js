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

test('the card and PDF data carry the fit factor only for legacy Quantitative records', () => {
  expect(getEcardFormDataFromTest({
    clientName: 'Legacy Quant',
    fitTestMethod: 'Quantitative',
    fitFactor: 180,
  })).toEqual(expect.objectContaining({ fitTestMethod: 'Quantitative', fitFactor: '180' }));

  expect(getEcardFormDataFromTest({
    clientName: 'Qual',
    fitTestMethod: 'Qualitative',
    fitFactor: 100,
  })).not.toHaveProperty('fitFactor');
  expect(getEcardFormDataFromTest({ clientName: 'New' })).not.toHaveProperty('fitFactor');
});
