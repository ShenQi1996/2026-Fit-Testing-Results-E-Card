import React from 'react';

const FormCheckbox = ({
  id,
  checked,
  onChange,
  disabled = false,
  error = '',
  children,
  className = '',
}) => (
  <div className={`form-group ${className}`.trim()}>
    <label htmlFor={id} className="checkbox-label">
      <input
        type="checkbox"
        id={id}
        className="form-checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{children}</span>
    </label>
    {error ? <span className="form-error-message">{error}</span> : null}
  </div>
);

export default FormCheckbox;
