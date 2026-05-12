import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import FormSelect from '../common/FormSelect';

// List of schools - customize this list with your actual school names
const SCHOOLS_OPTIONS = [
  { value: 'Helene College of Nursing', label: 'Helene College of Nursing' },
  { value: 'School B', label: 'School B' },
  { value: 'School C', label: 'School C' },
  { value: 'School D', label: 'School D' },
  { value: 'Other', label: 'Other' },
];

const RespiratoryProtectionProgramSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  return (
    <FormSection title="Written Respiratory Protection Program Verification">
      <div className="form-group">
        <label htmlFor="schoolsOnFile" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="schoolsOnFile"
            checked={formData.schoolsOnFile || false}
            onChange={(e) => onChange('schoolsOnFile', e.target.checked)}
            disabled={isLoading}
            style={{
              width: '18px',
              height: '18px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              accentColor: 'var(--accent-teal)',
            }}
          />
          <span>Schools are on file</span>
        </label>
        {fieldErrors?.schoolsOnFile && (
          <span className="form-error-message">{fieldErrors.schoolsOnFile}</span>
        )}
      </div>

      <FormSelect
        id="schoolsList"
        label="List of Schools Clients"
        value={formData.schoolsList || ''}
        onChange={(e) => onChange('schoolsList', e.target.value)}
        options={SCHOOLS_OPTIONS}
        placeholder="Helene College of Nursing"
        disabled={isLoading}
        error={fieldErrors?.schoolsList}
      />

      <div className="form-row">
        <FormInput
          id="programAdministratorName"
          label="Program Administrator Name"
          type="text"
          value={formData.programAdministratorName || ''}
          onChange={(e) => onChange('programAdministratorName', e.target.value)}
          placeholder="Enter program administrator name"
          disabled={isLoading}
          error={fieldErrors?.programAdministratorName}
        />
        <FormInput
          id="programAdministratorContact"
          label="Program Administrator Contact"
          type="text"
          value={formData.programAdministratorContact || ''}
          onChange={(e) => onChange('programAdministratorContact', e.target.value)}
          placeholder="Enter email or phone number"
          disabled={isLoading}
          error={fieldErrors?.programAdministratorContact}
        />
      </div>
    </FormSection>
  );
};

export default RespiratoryProtectionProgramSection;