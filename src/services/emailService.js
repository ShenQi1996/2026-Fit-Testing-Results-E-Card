// Email service for sending e-cards via EmailJS

import emailjs from '@emailjs/browser';
import { generateFitTestCard } from '../utils/ecardTemplates';

// EmailJS Configuration - Replace with your credentials
// Get these from: https://dashboard.emailjs.com/admin/account
const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_u84chaq',
  TEMPLATE_ID: 'template_n6pvpvf',
  PUBLIC_KEY: 'S3Owi-2s2Q_FCXW1k',
};

// Check if EmailJS is configured
const isEmailJSConfigured = () => {
  return EMAILJS_CONFIG.SERVICE_ID !== 'YOUR_SERVICE_ID' &&
         EMAILJS_CONFIG.TEMPLATE_ID !== 'YOUR_TEMPLATE_ID' &&
         EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY';
};

/**
 * Send fit test results e-card via email
 * @param {object} formData - Form data containing fit test information
 * @returns {Promise<void>}
 */
export const sendFitTestCard = async (formData) => {
  // Check if EmailJS is configured
  if (!isEmailJSConfigured()) {
    throw new Error('EmailJS is not configured. Please set up EmailJS credentials in src/services/emailService.js');
  }

  // Validate recipient email
  if (!formData.recipientEmail || !formData.recipientEmail.trim()) {
    throw new Error('Recipient email address is required');
  }

  // Generate HTML e-card content
  const htmlContent = generateFitTestCard(formData);

  // Prepare email template parameters
  // Note: EmailJS uses these variable names - make sure your template uses the same names
  const templateParams = {
    to_email: formData.recipientEmail.trim(),
    to_name: formData.clientName || 'Recipient',
    message: htmlContent,
    html_message: htmlContent,
    subject: 'Fit Testing Results E-card',
    reply_to: formData.recipientEmail.trim(),
  };

  // Send email using EmailJS
  try {
    await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams,
      EMAILJS_CONFIG.PUBLIC_KEY
    );
  } catch (error) {
    console.error('EmailJS Error:', error);
    // Provide more helpful error messages
    if (error.text && error.text.includes('recipients address is empty')) {
      throw new Error('Recipient email is missing. Please check your EmailJS template "To Email" field is set to {{to_email}}');
    }
    throw error;
  }
};

