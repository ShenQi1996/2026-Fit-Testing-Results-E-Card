import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import FormSelect from '../common/FormSelect';
import FormCheckbox from '../common/FormCheckbox';

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

      <FormSelect
        id="schoolsList"
        label="School / client"
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
            label="School name"
            type="text"
            value={formData.schoolsList || ''}
            onChange={(e) => onChange('schoolsList', e.target.value)}
            placeholder="Enter school name"
            required
            disabled={isLoading}
            error={fieldErrors?.schoolsList}
          />

          <FormCheckbox
            id="setSchoolProfileAsDefault"
            className="nested-checkbox"
            checked={setSchoolProfileAsDefault}
            onChange={onSetSchoolProfileAsDefaultChange}
            disabled={isLoading}
          >
            Save as new default school
          </FormCheckbox>
        </>
      )}

      <div className="form-row">
        <FormInput
          id="programAdministratorName"
          label="Program administrator name"
          type="text"
          value={formData.programAdministratorName || ''}
          onChange={(e) => onChange('programAdministratorName', e.target.value)}
          placeholder="Enter program administrator name"
          disabled={isLoading}
          error={fieldErrors?.programAdministratorName}
        />
        <FormInput
          id="programAdministratorContact"
          label="Program administrator contact"
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
