import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import { formatDateInput } from '../../utils/dateUtils';

const ClientInfoSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  const handleDobChange = (e) => {
    const formattedValue = formatDateInput(e.target.value);
    onChange('dob', formattedValue);
  };

  return (
    <FormSection title="Client Information">
      <div className="form-row">
        <FormInput
          id="clientName"
          label="Client Name"
          type="text"
          value={formData.clientName}
          onChange={(e) => onChange('clientName', e.target.value)}
          placeholder="Enter client name"
          required
          disabled={isLoading}
          error={fieldErrors?.clientName}
        />
        <FormInput
          id="dob"
          label="Date of Birth"
          type="text"
          value={formData.dob}
          onChange={handleDobChange}
          placeholder="MM/DD/YYYY"
          maxLength={10}
          disabled={isLoading}
        />
      </div>
    </FormSection>
  );
};

export default ClientInfoSection;

