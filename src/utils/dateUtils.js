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

