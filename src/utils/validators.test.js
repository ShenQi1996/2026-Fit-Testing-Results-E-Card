import { validateEmail, validateFitTestForm } from './validators';

const validForm = () => ({
  recipientEmail: 'person@example.com',
  clientName: 'Jane Smith',
  fitTester: 'Sam Qi',
  testLocation: 'Harlem',
  issueDate: '01/15/2026',
  fitTestType: 'N95',
  respiratorMfg: '3M',
  model: '1860',
  style: 'Filtering facepiece',
  fitTestMethod: 'Qualitative',
  testingAgent: 'Bitrex',
  maskSize: 'Regular',
  result: 'Pass',
  printedName: 'Jane Smith',
  studentClearanceConfirmed: true,
  consentToFitTest: true,
  privacyPolicyAcknowledged: true,
  recordDeliveryConfirmed: true,
  testerAttestationProtocolFollowed: true,
  testerAttestationConsentWitnessed: true,
  testerAttestationRespiratorMatchesRecord: true,
  testerMedicalRestrictionsReceived: false,
  facialHairInterfering: false,
  respiratorDonnedCorrectly: true,
});

describe('form validators', () => {
  test('validateEmail accepts a normal address and rejects blanks', () => {
    expect(validateEmail('person@example.com')).toBe(true);
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });

  test('validateFitTestForm requires the core fields and both signatures', () => {
    expect(validateFitTestForm(validForm(), true, true).isValid).toBe(true);

    const missingEmail = validateFitTestForm({
      ...validForm(),
      recipientEmail: ' ',
    }, true, true);
    expect(missingEmail.isValid).toBe(false);
    expect(missingEmail.fieldErrors.recipientEmail).toMatch(/email/i);

    const missingSignature = validateFitTestForm(validForm(), false, true);
    expect(missingSignature.fieldErrors.signature).toMatch(/signature/i);
  });

  test('solution expiration cannot be before the open date', () => {
    const result = validateFitTestForm({
      ...validForm(),
      solutionOpenDate: '02/02/2026',
      solutionExpirationDate: '01/01/2026',
    }, true, true);

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.solutionExpirationDate).toMatch(/on or after open date/i);
  });

  test('respirator model, style, method, and quantitative fit factor are required', () => {
    const missingModel = validateFitTestForm({ ...validForm(), model: ' ' }, true, true);
    expect(missingModel.fieldErrors.model).toMatch(/model/i);

    const missingStyle = validateFitTestForm({ ...validForm(), style: '' }, true, true);
    expect(missingStyle.fieldErrors.style).toMatch(/style/i);

    const missingMethod = validateFitTestForm({ ...validForm(), fitTestMethod: '' }, true, true);
    expect(missingMethod.fieldErrors.fitTestMethod).toMatch(/qualitative or quantitative/i);

    const quantitative = validateFitTestForm({
      ...validForm(),
      fitTestMethod: 'Quantitative',
      fitFactor: '',
    }, true, true);
    expect(quantitative.fieldErrors.fitFactor).toMatch(/fit factor/i);

    const withFactor = validateFitTestForm({
      ...validForm(),
      fitTestMethod: 'Quantitative',
      fitFactor: '100',
    }, true, true);
    expect(withFactor.isValid).toBe(true);

    const qualitative = validateFitTestForm({
      ...validForm(),
      fitTestMethod: 'Qualitative',
      fitFactor: '',
    }, true, true);
    expect(qualitative.isValid).toBe(true);
  });
});
