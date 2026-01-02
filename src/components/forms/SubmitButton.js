import React from 'react';

const SubmitButton = ({ isLoading, disabled }) => {
  return (
    <button 
      type="submit" 
      className="submit-button"
      disabled={disabled || isLoading}
    >
      {isLoading ? 'Sending E-Card...' : 'Send Fit Test Results E-Card'}
    </button>
  );
};

export default SubmitButton;

