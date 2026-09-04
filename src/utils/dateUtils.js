// Date utility functions

/**
 * Get today's date in MM/DD/YYYY format
 * @returns {string} Formatted date string
 */
export const getTodayDate = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  return `${month}/${day}/${year}`;
};

/**
 * Format date input as MM/DD/YYYY
 * Automatically adds slashes as user types
 * @param {string} value - Raw input value
 * @returns {string} Formatted date string
 */
export const formatDateInput = (value) => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 8 digits (MMDDYYYY)
  const limitedDigits = digits.slice(0, 8);
  
  // Format with slashes
  if (limitedDigits.length === 0) {
    return '';
  } else if (limitedDigits.length <= 2) {
    // MM
    return limitedDigits;
  } else if (limitedDigits.length <= 4) {
    // MM/DD
    return `${limitedDigits.slice(0, 2)}/${limitedDigits.slice(2)}`;
  } else {
    // MM/DD/YYYY
    return `${limitedDigits.slice(0, 2)}/${limitedDigits.slice(2, 4)}/${limitedDigits.slice(4)}`;
  }
};

/**
 * Parse MM/DD/YYYY date string to Date object
 * @param {string} dateString - Date string in MM/DD/YYYY format
 * @returns {Date|null} Date object or null if invalid
 */
export const parseDateString = (dateString) => {
  if (!dateString) return null;
  try {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Calculate expiration date (test date + 1 year)
 * Handles leap years safely by adding 1 calendar year
 * @param {string} testDateString - Test date in MM/DD/YYYY format
 * @returns {string} Expiration date in MM/DD/YYYY format, or empty string if invalid
 */
export const calculateExpirationDate = (testDateString) => {
  if (!testDateString) return '';
  
  const testDate = parseDateString(testDateString);
  if (!testDate) return '';
  
  // Add 1 year to the test date
  const expirationDate = new Date(testDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);
  
  // Format as MM/DD/YYYY
  const month = String(expirationDate.getMonth() + 1).padStart(2, '0');
  const day = String(expirationDate.getDate()).padStart(2, '0');
  const year = expirationDate.getFullYear();
  
  return `${month}/${day}/${year}`;
};

/** Fit test records are kept this long from the test date, then removed. */
export const FIT_TEST_RETENTION_YEARS = 3;

const startOfLocalDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Date used for retention: issue/test date, or createdAt if issue date is missing.
 * @param {object} record
 * @returns {Date|null}
 */
export const getFitTestRetentionDate = (record) => {
  if (!record) return null;

  const fromIssue = parseDateString(record.issueDate);
  if (fromIssue && !Number.isNaN(fromIssue.getTime())) {
    return startOfLocalDay(fromIssue);
  }

  const createdAt = record.createdAt;
  if (!createdAt) return null;

  if (typeof createdAt.toDate === 'function') {
    const fromTimestamp = createdAt.toDate();
    return fromTimestamp && !Number.isNaN(fromTimestamp.getTime())
      ? startOfLocalDay(fromTimestamp)
      : null;
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
};

/**
 * True when a fit test is older than the retention window (3 years).
 * Undated records are kept so we do not delete by accident.
 * @param {object} record
 * @param {Date} [now]
 * @returns {boolean}
 */
export const isFitTestPastRetention = (record, now = new Date()) => {
  const recordDate = getFitTestRetentionDate(record);
  if (!recordDate) return false;

  const cutoff = startOfLocalDay(now);
  cutoff.setFullYear(cutoff.getFullYear() - FIT_TEST_RETENTION_YEARS);
  return recordDate < cutoff;
};

