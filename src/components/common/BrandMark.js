import React from 'react';

const BrandMark = ({ compact = false }) => (
  <div className="brand-mark">
    <img src="/logo.png" alt="" className="brand-mark-logo brand-mark-logo-light" />
    <img src="/logo-on-dark.png" alt="" className="brand-mark-logo brand-mark-logo-dark" />
    <span>
      <span className="brand-mark-title">
        Secure Fit <span>LLC</span>
      </span>
      {!compact && (
        <span className="brand-mark-tagline">Precision in every breath</span>
      )}
    </span>
  </div>
);

export default BrandMark;
