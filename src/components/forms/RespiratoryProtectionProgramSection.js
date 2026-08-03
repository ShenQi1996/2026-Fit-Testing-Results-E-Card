import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import FormSelect from '../common/FormSelect';

const RespiratoryProtectionProgramSection = ({
  formData,
  onChange,
  schoolOptions = [],
  selectedSchoolOption,
  onSchoolOptionChange,
  setSchoolProfileAsDefault,
  onSetSchoolProfileAsDefaultChange,
  isAddingNewSchoolProfile,
  isLoadingSchoolProfiles,
  isLoading,
  fieldErrors,
}) => {
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
        label="School / Client"
        value={selectedSchoolOption || ''}
        onChange={(e) => onSchoolOptionChange(e.target.value)}
        options={schoolOptions}
        disabled={isLoading || isLoadingSchoolProfiles}
        error={fieldErrors?.schoolsList}
      />

      {isAddingNewSchoolProfile && (
        <>
          <FormInput
            id="schoolsListOther"
            label="Specify School Name"
            type="text"
            value={formData.schoolsList || ''}
            onChange={(e) => onChange('schoolsList', e.target.value)}
            placeholder="Enter school name"
            required
            disabled={isLoading}
            error={fieldErrors?.schoolsList}
          />

          <div className="form-group" style={{ marginTop: '-6px' }}>
            <label
              htmlFor="setSchoolProfileAsDefault"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                id="setSchoolProfileAsDefault"
                checked={setSchoolProfileAsDefault}
                onChange={(e) => onSetSchoolProfileAsDefaultChange(e.target.checked)}
                disabled={isLoading}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  accentColor: 'var(--accent-teal)',
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                Save as new default school
              </span>
            </label>
          </div>
        </>
      )}

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
