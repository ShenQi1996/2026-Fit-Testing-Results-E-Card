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

