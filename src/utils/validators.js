// Validation utility functions

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate fit test form data
 * @param {object} formData - Form data to validate
 * @param {boolean} hasStrokes - Whether signature has strokes
 * @returns {object} { isValid: boolean, error: string, fieldErrors: object }
 */
export const validateFitTestForm = (formData, hasStrokes = false) => {
  const fieldErrors = {};

  // Validate recipient email
  if (!formData.recipientEmail?.trim()) {
    fieldErrors.recipientEmail = 'Please enter recipient email address.';
  } else if (!validateEmail(formData.recipientEmail)) {
    fieldErrors.recipientEmail = 'Please enter a valid email address.';
  }

  // Validate client name
  if (!formData.clientName?.trim()) {
    fieldErrors.clientName = 'Please enter client name.';
  }

  // Validate fit tester
  if (!formData.fitTester?.trim()) {
    fieldErrors.fitTester = 'Please enter fit tester name.';
  }

  // Validate issue date
  if (!formData.issueDate?.trim()) {
    fieldErrors.issueDate = 'Please enter issue date.';
  }

  // Validate fit test type
  if (!formData.fitTestType?.trim()) {
    fieldErrors.fitTestType = 'Please select fit test type.';
  }

  // Validate respirator MFG
  if (!formData.respiratorMfg?.trim()) {
    fieldErrors.respiratorMfg = 'Please select respirator manufacturer.';
  }

  // Validate testing agent
  if (!formData.testingAgent?.trim()) {
    fieldErrors.testingAgent = 'Please select testing agent.';
  }

  // Validate mask size
  if (!formData.maskSize?.trim()) {
    fieldErrors.maskSize = 'Please select mask size.';
  }

  // Validate result
  if (!formData.result?.trim()) {
    fieldErrors.result = 'Please select result.';
  }

  // Validate printed name
  if (!formData.printedName?.trim()) {
    fieldErrors.printedName = 'Please enter printed name.';
  }

  // Validate signature
  if (!hasStrokes) {
    fieldErrors.signature = 'Please provide your signature.';
  }

  const isValid = Object.keys(fieldErrors).length === 0;
  const error = isValid ? '' : Object.values(fieldErrors)[0]; // First error message

  return { isValid, error, fieldErrors };
};