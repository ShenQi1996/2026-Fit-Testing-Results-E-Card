import React from 'react';
import BrandMark from './BrandMark';
import { useAuth } from '../../context/AuthContext';
import '../auth/Auth.css';

const HomePage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark />
        </div>
        <p className="auth-kicker">E-card portal</p>
        <h2 className="auth-title">Choose how to continue</h2>
        <p className="auth-subtitle">
          Scan the QR code on an issued e-card, resend a lost card, or sign in if you send records
          for Secure Fit LLC.
        </p>

        <div className="home-actions">
          <a href="/verify" className="auth-button home-action-button">
            Verify an e-card
          </a>
          <p className="home-action-hint">
            Scan the QR code or enter the code from a Secure Fit e-card.
          </p>

          <a href="/resend" className="google-button home-action-button">
            Resend my e-card
          </a>
          <p className="home-action-hint">
            Lost your e-card? Look it up with your name, date of birth, and email.
          </p>

          <a href="/staff_login" className="google-button home-action-button">
            {isAuthenticated ? 'Open staff app' : 'Staff login'}
          </a>
          <p className="home-action-hint">
            For testers and admins who send and manage fit test records.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
