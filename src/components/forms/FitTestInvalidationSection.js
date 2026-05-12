import React from 'react';
import FormSection from '../common/FormSection';
import FormSelect from '../common/FormSelect';

const FAILURE_REASON_OPTIONS = [
  { value: 'Improper seal', label: 'Improper seal' },
  { value: 'Taste detected', label: 'Taste detected' },
  { value: 'Respirator movement', label: 'Respirator movement' },
  { value: 'Other', label: 'Other' },
];

const FitTestInvalidationSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  // Show failure reason UI when either checkbox indicates a problem
  // Facial hair = YES (checked) OR Respirator donned = NO (unchecked)
  const showFailureReasonUI = formData.facialHairInterfering === true || formData.respiratorDonnedCorrectly === false;

  return (
    <FormSection title="Fit test invalidation conditions">
      <div className="form-group">
        <label htmlFor="facialHairInterfering" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="facialHairInterfering"
            checked={formData.facialHairInterfering || false}
            onChange={(e) => {
              onChange('facialHairInterfering', e.target.checked);
              // Clear failure reason fields when checkbox is unchecked and respirator is donned correctly
              if (!e.target.checked && formData.respiratorDonnedCorrectly !== false) {
                onChange('failureReason', '');
                onChange('correctiveActionNote', '');
              }
            }}
            disabled={isLoading}
            style={{
              width: '18px',
              height: '18px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              accentColor: 'var(--accent-teal)',
            }}
          />
          <span>Facial hair interfering with seal</span>
        </label>
        {fieldErrors?.facialHairInterfering && (
          <span className="form-error-message">{fieldErrors.facialHairInterfering}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="respiratorDonnedCorrectly" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="respiratorDonnedCorrectly"
            checked={formData.respiratorDonnedCorrectly !== false}
            onChange={(e) => {
              onChange('respiratorDonnedCorrectly', e.target.checked);
              // Clear failure reason fields when checkbox is checked and facial hair is not interfering
              if (e.target.checked && formData.facialHairInterfering !== true) {
                onChange('failureReason', '');
                onChange('correctiveActionNote', '');
              }
            }}
            disabled={isLoading}
            style={{
              width: '18px',
              height: '18px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              accentColor: 'var(--accent-teal)',
            }}
          />
          <span>Respirator donned correctly confirmed</span>
        </label>
        {fieldErrors?.respiratorDonnedCorrectly && (
          <span className="form-error-message">{fieldErrors.respiratorDonnedCorrectly}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="employeeSealCheckInstructionProvided" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="employeeSealCheckInstructionProvided"
            checked={formData.employeeSealCheckInstructionProvided || false}
            onChange={(e) => onChange('employeeSealCheckInstructionProvided', e.target.checked)}
            disabled={isLoading}
            style={{
              width: '18px',
              height: '18px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              accentColor: 'var(--accent-teal)',
            }}
          />
          <span>Employee has been instructed on proper seal check</span>
        </label>
        {fieldErrors?.employeeSealCheckInstructionProvided && (
          <span className="form-error-message">{fieldErrors.employeeSealCheckInstructionProvided}</span>
        )}
      </div>

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

          <div className="form-group">
            <label htmlFor="correctiveActionNote">
              Corrective action note <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <textarea
              id="correctiveActionNote"
              className={`form-textarea ${fieldErrors?.correctiveActionNote ? 'form-input-error' : ''}`}
              value={formData.correctiveActionNote || ''}
              onChange={(e) => onChange('correctiveActionNote', e.target.value)}
              placeholder="Enter corrective action note"
              required
              disabled={isLoading}
              rows={4}
            />
            {fieldErrors?.correctiveActionNote && (
              <span className="form-error-message">{fieldErrors.correctiveActionNote}</span>
            )}
          </div>
        </>
      )}
    </FormSection>
  );
};

export default FitTestInvalidationSection;
