import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import FormSelect from '../common/FormSelect';

const FIT_TEST_TYPE_OPTIONS = [
  { value: 'N95', label: 'N95' },
  { value: 'N99', label: 'N99' },
  { value: 'N100', label: 'N100' },
  { value: 'P100', label: 'P100' },
  { value: 'Half Face', label: 'Half Face' },
  { value: 'Full Face', label: 'Full Face' },
];

const RESPIRATOR_MFG_OPTIONS = [
  { value: '3M', label: '3M' },
  { value: 'Honeywell', label: 'Honeywell' },
  { value: 'Moldex', label: 'Moldex' },
  { value: 'Kimberly-Clark', label: 'Kimberly-Clark' },
  { value: 'Other', label: 'Other' },
];

const TESTING_AGENT_OPTIONS = [
  { value: 'Bitrex', label: 'Bitrex' },
  { value: 'Saccharin', label: 'Saccharin' },
  { value: 'Isoamyl Acetate', label: 'Isoamyl Acetate' },
];

const MASK_SIZE_OPTIONS = [
  { value: 'Small', label: 'Small' },
  { value: 'Regular', label: 'Regular' },
  { value: 'Large', label: 'Large' },
];

const RESULT_OPTIONS = [
  { value: 'Pass', label: 'Pass' },
  { value: 'Fail', label: 'Fail' },
];

const FitTestDetailsSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  // Check if current respiratorMfg value is a custom "Other" value
  const isCustomMfg = formData.respiratorMfg && !RESPIRATOR_MFG_OPTIONS.find(opt => opt.value === formData.respiratorMfg);
  const showOtherInput = formData.respiratorMfg === 'Other' || isCustomMfg;
  const selectValue = isCustomMfg ? 'Other' : formData.respiratorMfg;

  return (
    <FormSection title="Fit Test Details">
      <div className="form-row">
        <FormInput
          id="issueDate"
          label="Issue Date"
          type="text"
          value={formData.issueDate}
          onChange={(e) => onChange('issueDate', e.target.value)}
          required
          disabled={isLoading}
          error={fieldErrors?.issueDate}
        />
        <FormSelect
          id="fitTestType"
          label="Fit Test Type"
          value={formData.fitTestType}
          onChange={(e) => onChange('fitTestType', e.target.value)}
          options={FIT_TEST_TYPE_OPTIONS}
          required
          disabled={isLoading}
          error={fieldErrors?.fitTestType}
        />
      </div>

      <div className="form-row">
        <div className="respirator-mfg-group">
          <FormSelect
            id="respiratorMfg"
            label="Respirator MFG"
            value={selectValue}
            onChange={(e) => {
              const selectedValue = e.target.value;
              if (selectedValue === 'Other') {
                onChange('respiratorMfg', 'Other');
              } else {
                onChange('respiratorMfg', selectedValue);
              }
            }}
            options={RESPIRATOR_MFG_OPTIONS}
            required
            disabled={isLoading}
            error={fieldErrors?.respiratorMfg}
          />
          {showOtherInput && (
            <FormInput
              id="respiratorMfgOther"
              label="Specify Respirator MFG"
              type="text"
              value={isCustomMfg ? formData.respiratorMfg : ''}
              onChange={(e) => onChange('respiratorMfg', e.target.value)}
              placeholder="Enter manufacturer name"
              required
              disabled={isLoading}
              error={fieldErrors?.respiratorMfg}
            />
          )}
        </div>
        <FormSelect
          id="testingAgent"
          label="Testing Agent"
          value={formData.testingAgent}
          onChange={(e) => onChange('testingAgent', e.target.value)}
          options={TESTING_AGENT_OPTIONS}
          required
          disabled={isLoading}
          error={fieldErrors?.testingAgent}
        />
      </div>

      <div className="form-row">
        <FormSelect
          id="maskSize"
          label="Mask Size"
          value={formData.maskSize}
          onChange={(e) => onChange('maskSize', e.target.value)}
          options={MASK_SIZE_OPTIONS}
          required
          disabled={isLoading}
          error={fieldErrors?.maskSize}
        />
        <FormInput
          id="model"
          label="Model"
          type="text"
          value={formData.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder="e.g., 1870+"
          disabled={isLoading}
        />
      </div>

      <div className="form-row">
        <FormSelect
          id="result"
          label="Result"
          value={formData.result}
          onChange={(e) => onChange('result', e.target.value)}
          options={RESULT_OPTIONS}
          required
          disabled={isLoading}
          error={fieldErrors?.result}
        />
        <FormInput
          id="fitTester"
          label="Fit Tester"
          type="text"
          value={formData.fitTester}
          onChange={(e) => onChange('fitTester', e.target.value)}
          placeholder="Enter fit tester name"
          required
          disabled={isLoading}
          error={fieldErrors?.fitTester}
        />
      </div>
    </FormSection>
  );
};

export default FitTestDetailsSection;

