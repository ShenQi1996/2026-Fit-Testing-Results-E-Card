import { parseDateString } from '../../utils/dateUtils';

export const FILTER_ALL = '__all__';

export const hasConsentOrSignature = (test) => Boolean(
  test.printedName ||
  test.signatureDataUrl ||
  test.testerSignatureDataUrl ||
  test.studentClearanceConfirmed !== undefined ||
  test.consentToFitTest !== undefined ||
  test.privacyPolicyAcknowledged !== undefined ||
  test.recordDeliveryConfirmed !== undefined ||
  test.optionalOrganizationRelease !== undefined ||
  test.optionalMarketingEmail !== undefined ||
  test.testerAttestationProtocolFollowed !== undefined ||
  test.testerAttestationConsentWitnessed !== undefined ||
  test.testerAttestationMedicalClearanceVerified !== undefined ||
  test.testerAttestationRespiratorMatchesRecord !== undefined ||
  test.testerMedicalRestrictionsReceived === true ||
  test.testerMedicalRestrictionsReceived === false ||
  test.testerNoMedicalRestrictionsReceived !== undefined ||
  test.testerMedicalRestrictionsNote
);

export const hasTesterAttestation = (test) =>
  test.testerAttestationProtocolFollowed !== undefined ||
  test.testerAttestationConsentWitnessed !== undefined ||
  test.testerAttestationMedicalClearanceVerified !== undefined ||
  test.testerAttestationRespiratorMatchesRecord !== undefined ||
  test.testerMedicalRestrictionsReceived === true ||
  test.testerMedicalRestrictionsReceived === false ||
  test.testerNoMedicalRestrictionsReceived !== undefined ||
  Boolean(test.testerMedicalRestrictionsNote);

export const medicalRestrictionsReceivedAnswer = (test) => {
  if (test.testerMedicalRestrictionsReceived === true || test.testerMedicalRestrictionsReceived === false) {
    return test.testerMedicalRestrictionsReceived;
  }
  if (test.testerNoMedicalRestrictionsReceived === true || test.testerNoMedicalRestrictionsReceived === false) {
    return test.testerNoMedicalRestrictionsReceived;
  }
  return undefined;
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

export const formatDateWithTime = (dateString, fallbackTimestamp = null) => {
  if (!dateString) return 'N/A';
  try {
    let date;

    if (dateString.includes('/') && dateString.split('/').length === 3) {
      const parts = dateString.split('/');
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      date = new Date(year, month, day);

      if (fallbackTimestamp) {
        const fallbackDate = new Date(fallbackTimestamp);
        date.setHours(fallbackDate.getHours());
        date.setMinutes(fallbackDate.getMinutes());
        date.setSeconds(fallbackDate.getSeconds());
      }
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
};

export const parseIssueDate = (dateString) => {
  if (!dateString) return null;
  try {
    const parsed = parseDateString(dateString);
    if (parsed) return parsed;
    return new Date(dateString);
  } catch (error) {
    console.error('Error parsing issueDate:', error);
    return null;
  }
};

export const getMonthKeyFromTest = (test) => {
  const dateToUse = parseIssueDate(test.issueDate) || (test.createdAt ? new Date(test.createdAt) : null);
  if (!dateToUse || isNaN(dateToUse.getTime())) return null;
  return `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
};

export const groupTestsByMonth = (tests) => {
  const sortedTests = [...tests].sort((a, b) => {
    const dateA = parseIssueDate(a.issueDate);
    const dateB = parseIssueDate(b.issueDate);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return dateB - dateA;
  });

  const grouped = {};

  sortedTests.forEach((test) => {
    const dateToUse = parseIssueDate(test.issueDate) || (test.createdAt ? new Date(test.createdAt) : null);
    if (!dateToUse) return;

    try {
      const monthKey = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
      const monthName = dateToUse.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthName,
          monthKey,
          year: dateToUse.getFullYear(),
          month: dateToUse.getMonth() + 1,
          tests: [],
        };
      }

      grouped[monthKey].tests.push(test);
    } catch (error) {
      console.error('Error grouping test:', error);
    }
  });

  return Object.values(grouped).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
};

export const getEcardFormDataFromTest = (test) => ({
  recipientEmail: test.recipientEmail || '',
  clientName: test.clientName || '',
  dob: test.dob || '',
  testLocation: test.testLocation || '',
  issueDate: test.issueDate || '',
  expirationDate: test.expirationDate || '',
  fitTestType: test.fitTestType || '',
  respiratorMfg: test.respiratorMfg || '',
  testingAgent: test.testingAgent || '',
  maskSize: test.maskSize || '',
  model: test.model || '',
  result: test.result || '',
  fitTester: test.fitTester || '',
  verificationToken: test.verificationToken || '',
});
