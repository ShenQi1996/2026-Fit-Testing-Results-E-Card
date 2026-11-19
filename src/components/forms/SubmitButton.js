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

export const SaveWithoutSendButton = ({ isSaving, disabled, onClick }) => {
  return (
    <button
      type="button"
      className="save-without-send-button"
      onClick={onClick}
      disabled={disabled || isSaving}
    >
      {isSaving ? 'Saving result…' : "Save result (don't send)"}
    </button>
  );
};

export default SubmitButton;
