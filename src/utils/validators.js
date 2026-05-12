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
 * @param {boolean} hasTesterStrokes - Whether tester signature has strokes
 * @returns {object} { isValid: boolean, error: string, fieldErrors: object }
 */
export const validateFitTestForm = (formData, hasStrokes = false, hasTesterStrokes = false) => {
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

  // Validate fit tester (always set to logged-in user's name, but validate it exists)
  if (!formData.fitTester?.trim()) {
    fieldErrors.fitTester = 'Fit tester name is required.';
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

  // Validate student clearance confirmation
  if (!formData.studentClearanceConfirmed) {
    fieldErrors.studentClearanceConfirmed = 'Please confirm student clearance.';
  }

  // Validate tester signature
  if (!hasTesterStrokes) {
    fieldErrors.testerSignature = 'Please provide tester signature.';
  }

  // Validate tester attestation checkboxes
  if (!formData.testerAttestationProtocolFollowed) {
    fieldErrors.testerAttestationProtocolFollowed = 'Please confirm that protocol was followed.';
  }

  if (!formData.testerAttestationMedicalClearanceVerified) {
    fieldErrors.testerAttestationMedicalClearanceVerified = 'Please confirm that medical clearance was verified.';
  }

  if (!formData.testerAttestationRespiratorMatchesRecord) {
    fieldErrors.testerAttestationRespiratorMatchesRecord = 'Please confirm that respirator matches record.';
  }

  // Validate fit test invalidation conditions
  // Show failure reason UI when either checkbox indicates a problem
  const showFailureReasonUI = formData.facialHairInterfering === true || formData.respiratorDonnedCorrectly === false;
  
  if (showFailureReasonUI) {
    // Failure reason is required when UI is visible
    if (!formData.failureReason?.trim()) {
      fieldErrors.failureReason = 'Please select a failure reason.';
    }
    
    // Corrective action note is required when UI is visible
    if (!formData.correctiveActionNote?.trim()) {
      fieldErrors.correctiveActionNote = 'Please enter a corrective action note.';
    }
  }

  // Validate equipment hygiene dates
  // Expiration date must be same day or after open date if both are present
  if (formData.solutionOpenDate?.trim() && formData.solutionExpirationDate?.trim()) {
    const parseDate = (dateString) => {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return null;
    };

    const openDate = parseDate(formData.solutionOpenDate);
    const expirationDate = parseDate(formData.solutionExpirationDate);

    if (openDate && expirationDate && expirationDate < openDate) {
      fieldErrors.solutionExpirationDate = 'Expiration date must be on or after open date.';
    }
  }

  const isValid = Object.keys(fieldErrors).length === 0;
  const error = isValid ? '' : Object.values(fieldErrors)[0]; // First error message

  return { isValid, error, fieldErrors };
};