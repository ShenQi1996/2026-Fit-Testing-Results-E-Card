import React from 'react';

const FormYesNo = ({
  name,
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  error = '',
}) => (
  <div className="form-group yes-no-question">
    <p className="yes-no-label" id={`${name}-label`}>
      {label}
      {required ? <span className="required-mark"> *</span> : null}
    </p>
    <div className="yes-no-options" role="radiogroup" aria-labelledby={`${name}-label`}>
      <label htmlFor={`${name}-yes`} className="yes-no-option">
        <input
          type="radio"
          id={`${name}-yes`}
          name={name}
          className="form-checkbox"
          checked={value === true}
          onChange={() => onChange(true)}
          disabled={disabled}
        />
        <span>Yes</span>
      </label>
      <label htmlFor={`${name}-no`} className="yes-no-option">
        <input
          type="radio"
          id={`${name}-no`}
          name={name}
          className="form-checkbox"
          checked={value === false}
          onChange={() => onChange(false)}
          disabled={disabled}
        />
        <span>No</span>
      </label>
    </div>
    {error ? <span className="form-error-message">{error}</span> : null}
  </div>
);

export default FormYesNo;
