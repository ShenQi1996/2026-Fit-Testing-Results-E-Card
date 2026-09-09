import React from 'react';

const FormInput = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  error = '',
  maxLength,
}) => {
  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label} {required ? <span className="required-mark">*</span> : null}
      </label>
      <input
        type={type}
        id={id}
        className={`form-input ${error ? 'form-input-error' : ''} ${className}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
      />
      {error && <span className="form-error-message">{error}</span>}
    </div>
  );
};

export default FormInput;

