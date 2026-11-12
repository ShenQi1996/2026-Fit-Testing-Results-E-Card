import React from 'react';
import FormSection from '../common/FormSection';
import FormSelect from '../common/FormSelect';
import FormCheckbox from '../common/FormCheckbox';

const RespiratoryProtectionProgramSection = ({
  formData,
  onChange,
  schoolOptions = [],
  onSchoolOptionChange,
  schoolLocked = false,
  schoolBlockedMessage = '',
  isLoadingSchoolProfiles,
  isLoading,
  fieldErrors,
}) => {
  const chosenSchool = (formData.schoolsList || '').trim();

  return (
    <FormSection title="Respiratory protection program">
      <FormCheckbox
        id="schoolsOnFile"
        checked={formData.schoolsOnFile || false}
        onChange={(checked) => onChange('schoolsOnFile', checked)}
        disabled={isLoading}
        error={fieldErrors?.schoolsOnFile}
      >
        Schools are on file
      </FormCheckbox>

      {schoolBlockedMessage ? (
        <p className="form-error-message" role="alert">{schoolBlockedMessage}</p>
      ) : schoolLocked ? (
        <div className="form-group">
          <label htmlFor="schoolsList">School / client</label>
          <div
            id="schoolsList"
            className="form-input"
            aria-label="School / client"
            aria-readonly="true"
          >
            {chosenSchool}
          </div>
        </div>
      ) : (
        <FormSelect
          id="schoolsList"
          label="School / client"
          value={chosenSchool}
          onChange={(e) => onSchoolOptionChange(e.target.value)}
          options={schoolOptions}
          placeholder={schoolOptions.length > 1 ? 'Select a school' : undefined}
          disabled={isLoading || isLoadingSchoolProfiles}
          error={fieldErrors?.schoolsList}
          required
        />
      )}
    </FormSection>
  );
};

export default RespiratoryProtectionProgramSection;
