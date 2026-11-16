import { getEcardFormDataFromTest, isFitTestEmailSent } from './resultsUtils';

test('isFitTestEmailSent treats legacy missing as sent, null as unsent, and a stamp as sent', () => {
  expect(isFitTestEmailSent({})).toBe(true);
  expect(isFitTestEmailSent({ clientName: 'Legacy' })).toBe(true);
  expect(isFitTestEmailSent({ emailSentAt: null })).toBe(false);
  expect(isFitTestEmailSent({ emailSentAt: '' })).toBe(false);
  expect(isFitTestEmailSent({ emailSentAt: '2026-11-16T15:00:00.000Z' })).toBe(true);
});

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
