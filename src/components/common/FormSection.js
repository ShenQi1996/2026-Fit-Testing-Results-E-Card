import React from 'react';

const FormSection = ({ title, children, className = '' }) => {
  return (
    <div className={`form-section ${className}`}>
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  );
};

export default FormSection;

