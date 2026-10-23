/* global process */
// Email service for sending e-cards via EmailJS

import emailjs from '@emailjs/browser';
import { generateFitTestCard } from '../utils/fitTestCardTemplate';

// Production EmailJS account. Left compiled in so APP_ENV-unset production sends
// exactly as before. Staging must not use it to reach real customers: see
// assertStagingRecipient. There is no separate staging EmailJS project yet.
const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_u84chaq',
  TEMPLATE_ID: 'template_n6pvpvf',
  PUBLIC_KEY: 'S3Owi-2s2Q_FCXW1k',
};

const STAGING_EMAIL_MESSAGE = 'Staging does not email real customers. Recipient must be an @example.com address.';

/**
 * Staging builds refuse every recipient outside @example.com.
 * Any other APP_ENV, including unset production, does not apply this check.
 * @param {string} recipientEmail
 * @param {string} [appEnv]
 */
export const assertStagingRecipient = (recipientEmail, appEnv) => {
  const resolvedEnv = appEnv === undefined ? process.env.APP_ENV : appEnv;
  if (resolvedEnv !== 'staging') return;
  const email = String(recipientEmail || '').trim().toLowerCase();
  if (!email.endsWith('@example.com')) {
    throw new Error(STAGING_EMAIL_MESSAGE);
  }
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

  assertStagingRecipient(formData.recipientEmail);

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

