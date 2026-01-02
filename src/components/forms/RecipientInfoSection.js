import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';

const RecipientInfoSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  return (
    <FormSection title="Recipient Information">
      <FormInput
        id="recipientEmail"
        label="Recipient Email Address"
        type="email"
        value={formData.recipientEmail}
        onChange={(e) => onChange('recipientEmail', e.target.value)}
        placeholder="Enter recipient's email"
        required
        disabled={isLoading}
        error={fieldErrors?.recipientEmail}
      />
    </FormSection>
  );
};

export default RecipientInfoSection;

