/**
 * CSV export helpers for fit test reporting
 */

const STANDARD_REPORT_COLUMNS = [
  { key: 'clientName', label: 'Client Name' },
  { key: 'dob', label: 'DOB' },
  { key: 'issueDate', label: 'Issue Date' },
  { key: 'expirationDate', label: 'Expiration Date' },
  { key: 'testLocation', label: 'Test Location' },
  { key: 'schoolsList', label: 'School / Client' },
  { key: 'fitTestType', label: 'Fit Test Type' },
  { key: 'respiratorMfg', label: 'Respirator MFG' },
  { key: 'model', label: 'Model' },
  { key: 'maskSize', label: 'Mask Size' },
  { key: 'testingAgent', label: 'Testing Agent' },
  { key: 'result', label: 'Result' },
  { key: 'fitTester', label: 'Fit Tester' },
  { key: 'failureReason', label: 'Failure Reason' },
  { key: 'correctiveActionNote', label: 'Corrective Action Note' },
];

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const formatFileDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Build a CSV string for the Standard Report columns.
 * @param {Array<object>} tests
 * @returns {string}
 */
export const buildFitTestsCsv = (tests = []) => {
  const header = STANDARD_REPORT_COLUMNS.map((column) => escapeCsvValue(column.label)).join(',');
  const rows = tests.map((test) =>
    STANDARD_REPORT_COLUMNS.map((column) => escapeCsvValue(test?.[column.key] ?? '')).join(',')
  );
  return [header, ...rows].join('\n');
};

/**
 * Trigger a browser download for fit test CSV export.
 * @param {Array<object>} tests
 * @param {string} [filenamePrefix='fit-tests']
 */
export const downloadFitTestsCsv = (tests = [], filenamePrefix = 'fit-tests') => {
  if (!Array.isArray(tests) || tests.length === 0) {
    throw new Error('No test results available to export.');
  }

  const csvContent = buildFitTestsCsv(tests);
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `${filenamePrefix}-${formatFileDate()}.csv`;

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
};
