import React from 'react';
import FormSection from '../common/FormSection';

const SensitivityScreeningSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  return (
    <FormSection title="Sensitivity screening documentation">
      <div className="form-group">
        <label htmlFor="sensitivityScreeningPerformed" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="sensitivityScreeningPerformed"
            checked={formData.sensitivityScreeningPerformed || false}
            onChange={(e) => onChange('sensitivityScreeningPerformed', e.target.checked)}
            disabled={isLoading}
            style={{
              width: '18px',
              height: '18px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              accentColor: 'var(--accent-teal)',
            }}
          />
          <span>Sensitivity screening performed</span>
        </label>
        {fieldErrors?.sensitivityScreeningPerformed && (
          <span className="form-error-message">{fieldErrors.sensitivityScreeningPerformed}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="sensitivityDetected" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="sensitivityDetected"
            checked={formData.sensitivityDetected || false}
            onChange={(e) => onChange('sensitivityDetected', e.target.checked)}
            disabled={isLoading}
            style={{
              width: '18px',
              height: '18px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              accentColor: 'var(--accent-teal)',
            }}
          />
          <span>Sensitivity detected</span>
        </label>
        {fieldErrors?.sensitivityDetected && (
          <span className="form-error-message">{fieldErrors.sensitivityDetected}</span>
        )}
      </div>
    </FormSection>
  );
};

export default SensitivityScreeningSection;
