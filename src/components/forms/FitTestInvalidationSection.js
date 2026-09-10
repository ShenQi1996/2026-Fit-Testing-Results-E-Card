import React from 'react';
import FormSection from '../common/FormSection';
import FormSelect from '../common/FormSelect';
import FormCheckbox from '../common/FormCheckbox';
import FormTextarea from '../common/FormTextarea';
import { FAILURE_REASON_OPTIONS } from '../../constants/fitTestOptions';

const FitTestInvalidationSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  const showFailureReasonUI = formData.facialHairInterfering === true || formData.respiratorDonnedCorrectly === false;

  return (
    <FormSection title="Fit test invalidation">
      <FormCheckbox
        id="facialHairInterfering"
        checked={formData.facialHairInterfering || false}
        onChange={(checked) => {
          onChange('facialHairInterfering', checked);
          if (!checked && formData.respiratorDonnedCorrectly !== false) {
            onChange('failureReason', '');
            onChange('correctiveActionNote', '');
          }
        }}
        disabled={isLoading}
        error={fieldErrors?.facialHairInterfering}
      >
        Facial hair interfering with seal
      </FormCheckbox>

      <FormCheckbox
        id="respiratorDonnedCorrectly"
        checked={formData.respiratorDonnedCorrectly !== false}
        onChange={(checked) => {
          onChange('respiratorDonnedCorrectly', checked);
          if (checked && formData.facialHairInterfering !== true) {
            onChange('failureReason', '');
            onChange('correctiveActionNote', '');
          }
        }}
        disabled={isLoading}
        error={fieldErrors?.respiratorDonnedCorrectly}
      >
        Respirator donned correctly
      </FormCheckbox>

      <FormCheckbox
        id="employeeSealCheckInstructionProvided"
        checked={formData.employeeSealCheckInstructionProvided || false}
        onChange={(checked) => onChange('employeeSealCheckInstructionProvided', checked)}
        disabled={isLoading}
        error={fieldErrors?.employeeSealCheckInstructionProvided}
      >
        Employee has been instructed on proper seal check
      </FormCheckbox>

      {showFailureReasonUI && (
        <>
          <FormSelect
            id="failureReason"
            label="Failure reason"
            value={formData.failureReason || ''}
            onChange={(e) => onChange('failureReason', e.target.value)}
            options={FAILURE_REASON_OPTIONS}
            placeholder="Select failure reason"
            required
            disabled={isLoading}
            error={fieldErrors?.failureReason}
          />

          <FormTextarea
            id="correctiveActionNote"
            label="Corrective action note"
            value={formData.correctiveActionNote || ''}
            onChange={(e) => onChange('correctiveActionNote', e.target.value)}
            placeholder="Enter corrective action note"
            required
            disabled={isLoading}
            error={fieldErrors?.correctiveActionNote}
          />
        </>
      )}
    </FormSection>
  );
};

export default FitTestInvalidationSection;
