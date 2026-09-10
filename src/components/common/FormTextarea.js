import React from 'react';

const FormTextarea = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error = '',
  rows = 4,
}) => (
  <div className="form-group">
    <label htmlFor={id}>
      {label} {required ? <span className="required-mark">*</span> : null}
    </label>
    <textarea
      id={id}
      className={`form-textarea ${error ? 'form-input-error' : ''}`}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      rows={rows}
    />
    {error ? <span className="form-error-message">{error}</span> : null}
  </div>
);

export default FormTextarea;
