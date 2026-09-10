import React from 'react';
import BrandMark from './BrandMark';
import '../auth/Auth.css';

const AuthPageShell = ({ children, cardClassName = '' }) => (
  <div className="auth-container">
    <div className={`auth-card ${cardClassName}`.trim()}>
      <div className="auth-brand">
        <BrandMark />
      </div>
      {children}
    </div>
  </div>
);

export const AuthFooterLinks = ({ children }) => (
  <div className="auth-switch">
    <p>{children}</p>
  </div>
);

export const AuthHomeLink = () => (
  <a href="/" className="auth-link">Back to home</a>
);

export default AuthPageShell;
