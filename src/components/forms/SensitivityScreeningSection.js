import React from 'react';
import FormSection from '../common/FormSection';
import FormCheckbox from '../common/FormCheckbox';

const SensitivityScreeningSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  return (
    <FormSection title="Sensitivity screening">
      <FormCheckbox
        id="sensitivityScreeningPerformed"
        checked={formData.sensitivityScreeningPerformed || false}
        onChange={(checked) => onChange('sensitivityScreeningPerformed', checked)}
        disabled={isLoading}
        error={fieldErrors?.sensitivityScreeningPerformed}
      >
        Sensitivity screening performed
      </FormCheckbox>

      <FormCheckbox
        id="sensitivityDetected"
        checked={formData.sensitivityDetected || false}
        onChange={(checked) => onChange('sensitivityDetected', checked)}
        disabled={isLoading}
        error={fieldErrors?.sensitivityDetected}
      >
        Sensitivity detected
      </FormCheckbox>
    </FormSection>
  );
};

export default SensitivityScreeningSection;
