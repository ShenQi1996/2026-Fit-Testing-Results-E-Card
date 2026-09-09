import React from 'react';
import BrandMark from './BrandMark';
import '../auth/Auth.css';

const HomePage = () => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark />
        </div>
        <p className="auth-kicker">E-card portal</p>
        <h2 className="auth-title">Choose how to continue</h2>
        <p className="auth-subtitle">
          Look up a lost fit-test card, or sign in if you send records for Secure Fit LLC.
        </p>

        <div className="home-actions">
          <a href="/resend" className="auth-button home-action-button">
            Resend my e-card
          </a>
          <p className="home-action-hint">
            Lost your e-card? Look it up with your name, date of birth, and email.
          </p>

          <a href="/staff_login" className="google-button home-action-button">
            Staff login
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
