import React from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import FormSelect from '../common/FormSelect';
import {
  TESTING_AGENT_OPTIONS,
  TEST_LOCATION_OPTIONS,
  FIT_TEST_TYPE_OPTIONS,
  RESPIRATOR_MFG_OPTIONS,
  MASK_SIZE_OPTIONS,
  RESULT_OPTIONS,
  FIT_TEST_METHOD_OPTIONS,
  isCustomOptionValue,
} from '../../constants/fitTestOptions';

const FitTestDetailsSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  const isCustomMfg = isCustomOptionValue(formData.respiratorMfg, RESPIRATOR_MFG_OPTIONS);
  const showOtherInput = formData.respiratorMfg === 'Other' || isCustomMfg;
  const selectValue = isCustomMfg ? 'Other' : formData.respiratorMfg;

  const isCustomLocation = isCustomOptionValue(formData.testLocation, TEST_LOCATION_OPTIONS);
  const showLocationOtherInput = formData.testLocation === 'Other' || isCustomLocation;
  const locationSelectValue = isCustomLocation ? 'Other' : formData.testLocation;

  return (
    <FormSection title="Fit test details">
      <div className="form-row">
        <div className="respirator-mfg-group">
          <FormSelect
            id="testLocation"
            label="Test location"
            value={locationSelectValue || ''}
            onChange={(e) => onChange('testLocation', e.target.value)}
            options={TEST_LOCATION_OPTIONS}
            required
            disabled={isLoading}
            error={fieldErrors?.testLocation}
          />
          {showLocationOtherInput && (
            <FormInput
              id="testLocationOther"
              label="Specify location"
              type="text"
              value={isCustomLocation ? formData.testLocation : ''}
              onChange={(e) => onChange('testLocation', e.target.value)}
              placeholder="Enter location"
              required
              disabled={isLoading}
              error={fieldErrors?.testLocation}
            />
          )}
        </div>
        <FormInput
          id="issueDate"
          label="Issue date"
          type="text"
          value={formData.issueDate}
          onChange={(e) => onChange('issueDate', e.target.value)}
          required
          disabled={isLoading}
          error={fieldErrors?.issueDate}
        />
      </div>

      <div className="form-row">
        <FormSelect
          id="fitTestType"
          label="Fit test type"
          value={formData.fitTestType}
          onChange={(e) => onChange('fitTestType', e.target.value)}
          options={FIT_TEST_TYPE_OPTIONS}
          required
          disabled={isLoading}
          error={fieldErrors?.fitTestType}
        />
      </div>

      <div className="form-row">
        <FormSelect
          id="fitTestMethod"
          label="Fit test method"
          value={formData.fitTestMethod || 'Locked to Qualitative'}
          onChange={() => {}}
          options={FIT_TEST_METHOD_OPTIONS}
          disabled
          error={fieldErrors?.fitTestMethod}
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
              label="Specify manufacturer"
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
          label="Testing agent"
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
          label="Mask size"
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
          label="Fit tester"
          type="text"
          value={formData.fitTester}
          onChange={() => {}}
          placeholder="Enter fit tester name"
          required
          disabled
          error={fieldErrors?.fitTester}
        />
      </div>
    </FormSection>
  );
};

export default FitTestDetailsSection;
