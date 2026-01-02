import React from 'react';

const FormSelect = ({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  placeholder,
  error = '',
}) => {
  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label} {required && '*'}
      </label>
      <select
        id={id}
        className={`form-input ${error ? 'form-input-error' : ''}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="form-error-message">{error}</span>}
    </div>
  );
};

export default FormSelect;

