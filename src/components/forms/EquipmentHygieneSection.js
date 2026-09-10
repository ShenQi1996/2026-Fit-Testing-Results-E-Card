import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import FormSelect from '../common/FormSelect';
import FormCheckbox from '../common/FormCheckbox';
import { formatDateInput } from '../../utils/dateUtils';
import { CLEANING_METHOD_OPTIONS } from '../../constants/fitTestOptions';

const EquipmentHygieneSection = ({
  formData,
  onChange,
  solutionTypeOptions,
  selectedSolutionOption,
  onSolutionOptionChange,
  setSolutionProfileAsDefault,
  onSetSolutionProfileAsDefaultChange,
  isAddingNewSolutionProfile,
  isLoadingSolutionProfiles,
  isLoading,
  fieldErrors,
}) => {
  const handleOpenDateChange = (e) => {
    onChange('solutionOpenDate', formatDateInput(e.target.value));
  };

  const handleExpirationDateChange = (e) => {
    onChange('solutionExpirationDate', formatDateInput(e.target.value));
  };

  return (
    <FormSection title="Equipment and solution">
      <div className="form-row form-row-full">
        <FormSelect
          id="solutionProfileSelection"
          label="Saved solution profiles"
          value={selectedSolutionOption}
          onChange={(e) => onSolutionOptionChange(e.target.value)}
          options={solutionTypeOptions}
          disabled={isLoading || isLoadingSolutionProfiles}
        />
      </div>

      {isAddingNewSolutionProfile && (
        <FormCheckbox
          id="setSolutionProfileAsDefault"
          className="nested-checkbox"
          checked={setSolutionProfileAsDefault}
          onChange={onSetSolutionProfileAsDefaultChange}
          disabled={isLoading}
        >
          Set as new default solution
        </FormCheckbox>
      )}

      {isAddingNewSolutionProfile && (
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
      )}

      <div className="form-row">
        {isAddingNewSolutionProfile && (
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
        )}
        <FormSelect
          id="cleaningMethod"
          label="Cleaning method"
          value={formData.cleaningMethod || ''}
          onChange={(e) => onChange('cleaningMethod', e.target.value)}
          options={CLEANING_METHOD_OPTIONS}
          disabled={isLoading}
          error={fieldErrors?.cleaningMethod}
        />
      </div>

      <div className="subsection-block">
        <h4 className="consent-subsection-title">Daily cleaning</h4>
        <div className="daily-cleaning">
          <FormCheckbox
            id="hoodCleaned"
            checked={formData.hoodCleaned !== undefined ? formData.hoodCleaned : true}
            onChange={(checked) => onChange('hoodCleaned', checked)}
            disabled={isLoading}
            error={fieldErrors?.hoodCleaned}
          >
            Hood cleaned
          </FormCheckbox>
          <FormCheckbox
            id="nebulizerCleaned"
            checked={formData.nebulizerCleaned !== undefined ? formData.nebulizerCleaned : true}
            onChange={(checked) => onChange('nebulizerCleaned', checked)}
            disabled={isLoading}
            error={fieldErrors?.nebulizerCleaned}
          >
            Nebulizer cleaned
          </FormCheckbox>
        </div>
      </div>
    </FormSection>
  );
};

export default EquipmentHygieneSection;
