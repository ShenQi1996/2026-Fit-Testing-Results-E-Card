// Fields copied from a fit test onto its public card documents
// (fitTestLookups for resend, fitTestVerifications for verify).
// Kept free of Firebase imports so the rules emulator tests can build the
// exact payloads the app writes.

export const LOOKUP_CARD_FIELDS = [
  'recipientEmail',
  'clientName',
  'dob',
  'testLocation',
  'issueDate',
  'expirationDate',
  'fitTestType',
  'respiratorMfg',
  'testingAgent',
  'maskSize',
  'model',
  'style',
  'fitTestMethod',
  'result',
  'fitTester',
  'verificationToken',
  // Carried for resend; the emailed card does not print them.
  'programAdministratorName',
  'programAdministratorContact',
];

export const VERIFY_CARD_FIELDS = [
  'clientName',
  'testLocation',
  'issueDate',
  'expirationDate',
  'fitTestType',
  'respiratorMfg',
  'maskSize',
  'model',
  'style',
  'fitTestMethod',
  'result',
  'fitTester',
  // Stored on the verification record; the public verify page does not list them.
  'programAdministratorName',
  'programAdministratorContact',
];

// Only legacy Quantitative records have a fit factor. The rules require each
// card copy to carry the parent's fitFactor unchanged, so copy it as stored
// when present and leave it off otherwise (new qualitative tests never have one).
const withStoredFitFactor = (data, record) => {
  if (record.fitFactor !== undefined && record.fitFactor !== null) {
    data.fitFactor = record.fitFactor;
  }
  return data;
};

export const toLookupCardData = (record = {}) => {
  const data = {};
  LOOKUP_CARD_FIELDS.forEach((field) => {
    data[field] = record[field] || '';
  });
  return withStoredFitFactor(data, record);
};

export const toVerifyCardData = (record = {}) => {
  const data = {};
  VERIFY_CARD_FIELDS.forEach((field) => {
    data[field] = record[field] || '';
  });
  return withStoredFitFactor(data, record);
};

const isQuantitativeMethod = (method) => (
  typeof method === 'string' && method.trim().toLowerCase() === 'quantitative'
);

/**
 * The stored fit factor to print for a legacy Quantitative record, or ''.
 * Qualitative records (all new tests) never show a fit factor.
 */
export const legacyFitFactorDisplay = (record = {}) => {
  if (!record || !isQuantitativeMethod(record.fitTestMethod)) return '';
  const value = record.fitFactor;
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  return text;
};
