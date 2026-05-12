import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import FormSelect from '../common/FormSelect';
import { formatDateInput } from '../../utils/dateUtils';

const CLEANING_METHOD_OPTIONS = [
  { value: 'Condition acceptable', label: 'Condition acceptable' },
  { value: 'Removed from service', label: 'Removed from service' },
];

const EquipmentHygieneSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  const handleOpenDateChange = (e) => {
    const formattedValue = formatDateInput(e.target.value);
    onChange('solutionOpenDate', formattedValue);
  };

  const handleExpirationDateChange = (e) => {
    const formattedValue = formatDateInput(e.target.value);
    onChange('solutionExpirationDate', formattedValue);
  };

  return (
    <FormSection title="Equipment hygiene and solution control">
      {/* Solution tracking fields */}
      <div className="form-row">
        <FormInput
          id="solutionType"
          label="Solution type"
          type="text"
          value={formData.solutionType || ''}
          onChange={(e) => onChange('solutionType', e.target.value)}
          placeholder="Enter solution type"
          disabled={isLoading}
          error={fieldErrors?.solutionType}
        />
        <FormInput
          id="solutionOpenDate"
          label="Open date"
          type="text"
          value={formData.solutionOpenDate || ''}
          onChange={handleOpenDateChange}
          placeholder="MM/DD/YYYY"
          maxLength={10}
          disabled={isLoading}
          error={fieldErrors?.solutionOpenDate}
        />
      </div>

      <div className="form-row">
        <FormInput
          id="solutionExpirationDate"
          label="Expiration date"
          type="text"
          value={formData.solutionExpirationDate || ''}
          onChange={handleExpirationDateChange}
          placeholder="MM/DD/YYYY"
          maxLength={10}
          disabled={isLoading}
          error={fieldErrors?.solutionExpirationDate}
        />
        <FormSelect
          id="cleaningMethod"
          label="Cleaning method"
          value={formData.cleaningMethod || ''}
          onChange={(e) => onChange('cleaningMethod', e.target.value)}
          options={CLEANING_METHOD_OPTIONS}
          placeholder="Select cleaning method"
          disabled={isLoading}
          error={fieldErrors?.cleaningMethod}
        />
      </div>

      {/* Daily cleaning record */}
      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px solid var(--border-color)' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: '16px' }}>Daily cleaning record</h4>
        <div style={{ 
          padding: '16px', 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="hoodCleaned" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="hoodCleaned"
                checked={formData.hoodCleaned !== undefined ? formData.hoodCleaned : true}
                onChange={(e) => onChange('hoodCleaned', e.target.checked)}
                disabled={isLoading}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  accentColor: 'var(--accent-teal)',
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Hood cleaned</span>
            </label>
            {fieldErrors?.hoodCleaned && (
              <span className="form-error-message">{fieldErrors.hoodCleaned}</span>
            )}
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="nebulizerCleaned" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="nebulizerCleaned"
                checked={formData.nebulizerCleaned !== undefined ? formData.nebulizerCleaned : true}
                onChange={(e) => onChange('nebulizerCleaned', e.target.checked)}
                disabled={isLoading}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  accentColor: 'var(--accent-teal)',
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Nebulizer cleaned</span>
            </label>
            {fieldErrors?.nebulizerCleaned && (
              <span className="form-error-message">{fieldErrors.nebulizerCleaned}</span>
            )}
          </div>
        </div>
      </div>
    </FormSection>
  );
};

export default EquipmentHygieneSection;
