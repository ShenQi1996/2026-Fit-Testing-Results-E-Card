import React, { useState } from 'react';
import { lookupFitTestForResend } from '../../services/firebaseDb';
import { sendFitTestCard } from '../../services/emailService';
import { formatDateInput, parseDateString } from '../../utils/dateUtils';
import { validateEmail } from '../../utils/validators';
import BrandMark from '../common/BrandMark';
import '../auth/Auth.css';

const SENT_MESSAGE = 'The e-card was sent to the email on file.';
const NOT_FOUND_MESSAGE =
  'No matching e-card was found. Name, date of birth, and email must all match the original test.';

const ResendCardPage = () => {
  const [clientName, setClientName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const name = clientName.trim();
    if (!name) {
      setError('Please enter the name on the e-card.');
      return;
    }
    if (!parseDateString(dob) || dob.length !== 10) {
      setError('Please enter a valid date of birth (MM/DD/YYYY).');
      return;
    }
    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const record = await lookupFitTestForResend(name, dob, email.trim());
      if (!record) {
        setError(NOT_FOUND_MESSAGE);
        return;
      }
      await sendFitTestCard(record);
      setSuccess(SENT_MESSAGE);
    } catch (err) {
      console.error('Error resending e-card:', err);
      setError(err.message || 'Unable to send the e-card right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark />
        </div>
        <p className="auth-kicker">Lost e-card</p>
        <h2 className="auth-title">Resend e-card</h2>
        <p className="auth-subtitle">
          Enter the name, date of birth, and email from your fit test. We will send your most recent
          e-card to that email.
        </p>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {success && <div className="auth-success" role="status">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="resend-client-name">Name</label>
            <input
              type="text"
              id="resend-client-name"
              className="form-input"
              placeholder="Enter the name on the e-card"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              autoComplete="name"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="resend-dob">Date of Birth</label>
            <input
              type="text"
              id="resend-dob"
              className="form-input"
              placeholder="MM/DD/YYYY"
              value={dob}
              onChange={(e) => setDob(formatDateInput(e.target.value))}
              inputMode="numeric"
              maxLength={10}
              autoComplete="bday"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="resend-email">Email Address</label>
            <input
              type="email"
              id="resend-email"
              className="form-input"
              placeholder="Enter the email used for your fit test"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Resend'}
          </button>
        </form>

        <div className="auth-switch">
          <p>
            <a href="/" className="auth-link">Back to home</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResendCardPage;
