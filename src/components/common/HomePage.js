import React from 'react';
import '../auth/Auth.css';

const HomePage = () => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Secure Fit LLC</h2>
        <p className="auth-subtitle">
          Choose how you would like to continue.
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
