import React from 'react';
import { calculateExpirationDate } from '../../utils/dateUtils';
import { RESULT_OPTIONS } from '../../constants/fitTestOptions';
import {
  PARTICIPANT_CONSENT_ITEMS,
  OPTIONAL_CONSENT_ITEMS,
  RECORD_DISCLAIMER,
  TESTER_ATTESTATION_TEXT,
  TESTER_ATTESTATION_ITEMS,
} from '../../constants/consentCopy';
import {
  formatDate,
  formatDateWithTime,
  hasConsentOrSignature,
  hasTesterAttestation,
  medicalRestrictionsReceivedAnswer,
} from './resultsUtils';
import ResultCardEditForm from './ResultCardEditForm';

const ResultRow = ({ label, value, wrap = false, style }) => (
  <div className="result-row">
    <span className="result-label">{label}</span>
    <span className={`result-value${wrap ? ' result-value--wrap' : ''}`} style={style}>{value}</span>
  </div>
);

const ResultCardView = ({ test, expanded, onToggleExpand }) => (
  <div className="result-card-body">
    <div className="result-section">
      <h4 className="result-section-title">Basic Information</h4>
      <ResultRow label="Date of Birth:" value={test.dob || 'N/A'} />
      <div className="result-row">
        <span className="result-label">Issue Date:</span>
        <span className="result-value">
          {test.issueDate ? formatDateWithTime(test.issueDate, test.createdAt) : 'N/A'}
        </span>
      </div>
      {test.issueDate && (
        <div className="result-row">
          <span className="result-label">Fit test expiration date:</span>
          <span className="result-value">
            {(() => {
              const expDate = test.expirationDate || calculateExpirationDate(test.issueDate);
              return expDate ? formatDateWithTime(expDate, test.createdAt) : 'N/A';
            })()}
          </span>
        </div>
      )}
      <ResultRow label="Test Location:" value={test.testLocation || 'N/A'} />
      <ResultRow label="Fit Test Type:" value={test.fitTestType || 'N/A'} />
      {test.fitTestMethod && (
        <ResultRow label="Fit Test Method:" value={test.fitTestMethod} />
      )}
      <ResultRow label="Fit Tester:" value={test.fitTester || 'N/A'} />
      {test.recipientEmail && (
        <ResultRow label="Sent To:" value={test.recipientEmail} />
      )}
      <ResultRow label="Created:" value={formatDate(test.createdAt)} />
    </div>

    {expanded && (
      <>
        <div className="result-section">
          <h4 className="result-section-title">Respirator Details</h4>
          <ResultRow label="Respirator MFG:" value={test.respiratorMfg || 'N/A'} />
          <ResultRow label="Testing Agent:" value={test.testingAgent || 'N/A'} />
          <ResultRow label="Mask Size:" value={test.maskSize || 'N/A'} />
          {test.model && <ResultRow label="Model:" value={test.model} />}
        </div>

        {(test.schoolsOnFile !== undefined || test.schoolsList || test.programAdministratorName || test.programAdministratorContact) && (
          <div className="result-section">
            <h4 className="result-section-title">Written Respiratory Protection Program</h4>
            {test.schoolsOnFile !== undefined && (
              <ResultRow label="Schools on file:" value={test.schoolsOnFile ? 'Yes' : 'No'} />
            )}
            {test.schoolsList && (
              <ResultRow label="School / Client:" value={test.schoolsList} />
            )}
            {test.programAdministratorName && (
              <ResultRow label="Program Administrator Name:" value={test.programAdministratorName} />
            )}
            {test.programAdministratorContact && (
              <ResultRow label="Program Administrator Contact:" value={test.programAdministratorContact} />
            )}
          </div>
        )}

        {(test.facialHairInterfering !== undefined || test.respiratorDonnedCorrectly !== undefined || test.employeeSealCheckInstructionProvided !== undefined || test.failureReason || test.correctiveActionNote) && (
          <div className="result-section">
            <h4 className="result-section-title">Fit Test Invalidation Conditions</h4>
            {test.facialHairInterfering !== undefined && (
              <ResultRow label="Facial hair interfering with seal:" value={test.facialHairInterfering ? 'Yes' : 'No'} />
            )}
            {test.respiratorDonnedCorrectly !== undefined && (
              <ResultRow label="Respirator donned correctly confirmed:" value={test.respiratorDonnedCorrectly ? 'Yes' : 'No'} />
            )}
            {test.employeeSealCheckInstructionProvided !== undefined && (
              <ResultRow label="Employee seal check instruction provided:" value={test.employeeSealCheckInstructionProvided ? 'Yes' : 'No'} />
            )}
            {(test.facialHairInterfering === true || test.respiratorDonnedCorrectly === false) && (
              <>
                {test.failureReason && (
                  <ResultRow label="Failure reason:" value={test.failureReason} />
                )}
                {test.correctiveActionNote && (
                  <ResultRow
                    label="Corrective action note:"
                    value={test.correctiveActionNote}
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {(test.sensitivityScreeningPerformed !== undefined || test.sensitivityDetected !== undefined) && (
          <div className="result-section">
            <h4 className="result-section-title">Sensitivity Screening Documentation</h4>
            {test.sensitivityScreeningPerformed !== undefined && (
              <ResultRow label="Sensitivity screening performed:" value={test.sensitivityScreeningPerformed ? 'Yes' : 'No'} />
            )}
            {test.sensitivityDetected !== undefined && (
              <ResultRow label="Sensitivity detected:" value={test.sensitivityDetected ? 'Yes' : 'No'} />
            )}
          </div>
        )}

        {(test.exerciseNormalBreathing !== undefined || test.exerciseDeepBreathing !== undefined || test.exerciseHeadSideToSide !== undefined || test.exerciseHeadUpAndDown !== undefined || test.exerciseTalking !== undefined || test.exerciseBendingOverOrJogging !== undefined || test.exerciseNormalBreathingAgain !== undefined) && (
          <div className="result-section">
            <h4 className="result-section-title">Required Exercise Checklist</h4>
            {test.exerciseNormalBreathing !== undefined && (
              <ResultRow label="Normal breathing:" value={test.exerciseNormalBreathing ? '✓ Completed' : '✗ Not completed'} />
            )}
            {test.exerciseDeepBreathing !== undefined && (
              <ResultRow label="Deep breathing:" value={test.exerciseDeepBreathing ? '✓ Completed' : '✗ Not completed'} />
            )}
            {test.exerciseHeadSideToSide !== undefined && (
              <ResultRow label="Head side to side:" value={test.exerciseHeadSideToSide ? '✓ Completed' : '✗ Not completed'} />
            )}
            {test.exerciseHeadUpAndDown !== undefined && (
              <ResultRow label="Head up and down:" value={test.exerciseHeadUpAndDown ? '✓ Completed' : '✗ Not completed'} />
            )}
            {test.exerciseTalking !== undefined && (
              <ResultRow label="Talking:" value={test.exerciseTalking ? '✓ Completed' : '✗ Not completed'} />
            )}
            {test.exerciseBendingOverOrJogging !== undefined && (
              <ResultRow label="Bending over or jogging in place:" value={test.exerciseBendingOverOrJogging ? '✓ Completed' : '✗ Not completed'} />
            )}
            {test.exerciseNormalBreathingAgain !== undefined && (
              <ResultRow label="Normal breathing again:" value={test.exerciseNormalBreathingAgain ? '✓ Completed' : '✗ Not completed'} />
            )}
          </div>
        )}

        {(test.solutionType || test.solutionOpenDate || test.solutionExpirationDate || test.cleaningMethod !== undefined || test.hoodCleaned !== undefined || test.nebulizerCleaned !== undefined) && (
          <div className="result-section">
            <h4 className="result-section-title">Equipment Hygiene and Solution Control</h4>
            {test.solutionType && <ResultRow label="Solution type:" value={test.solutionType} />}
            {test.solutionOpenDate && <ResultRow label="Solution open date:" value={test.solutionOpenDate} />}
            {test.solutionExpirationDate && <ResultRow label="Solution expiration date:" value={test.solutionExpirationDate} />}
            {test.cleaningMethod && <ResultRow label="Cleaning method:" value={test.cleaningMethod} />}
            {(test.hoodCleaned !== undefined || test.nebulizerCleaned !== undefined) && (
              <div className="result-subsection">
                <h5 className="result-subsection-title">Daily cleaning record</h5>
                {test.hoodCleaned !== undefined && (
                  <ResultRow label="Hood cleaned:" value={test.hoodCleaned ? 'Yes' : 'No'} />
                )}
                {test.nebulizerCleaned !== undefined && (
                  <ResultRow label="Nebulizer cleaned:" value={test.nebulizerCleaned ? 'Yes' : 'No'} />
                )}
              </div>
            )}
          </div>
        )}

        {hasConsentOrSignature(test) && (
          <div className="result-section">
            <h4 className="result-section-title">Consent</h4>

            <h5 className="result-subsection-title">Participant</h5>
            {PARTICIPANT_CONSENT_ITEMS.map((item) => (
              test[item.key] !== undefined ? (
                <div className="result-consent-item" key={item.key}>
                  <ResultRow label={`${item.title}:`} value={test[item.key] ? 'Yes' : 'No'} />
                  <p className="result-consent-text">{item.text}</p>
                </div>
              ) : null
            ))}

            <p className="result-consent-disclaimer">{RECORD_DISCLAIMER}</p>

            <h5 className="result-subsection-title">Optional</h5>
            {OPTIONAL_CONSENT_ITEMS.map((item) => (
              test[item.key] !== undefined ? (
                <div className="result-consent-item" key={item.key}>
                  <ResultRow
                    label={`${item.title}:`}
                    value={
                      item.key === 'optionalOrganizationRelease' && test.optionalOrganizationRelease
                        ? (test.organizationReleaseRecipient || 'Yes')
                        : (test[item.key] ? 'Yes' : 'No')
                    }
                  />
                  <p className="result-consent-text">{item.text}</p>
                </div>
              ) : null
            ))}

            {test.printedName && (
              <ResultRow label="Printed name:" value={test.printedName} />
            )}
            {test.signatureDataUrl && (
              <div className="signature-display-section">
                <div className="signature-display">
                  <span className="result-label">Participant signature:</span>
                  <div className="signature-image-container">
                    <img
                      src={test.signatureDataUrl}
                      alt="Participant signature"
                      className="signature-image"
                    />
                  </div>
                </div>
              </div>
            )}

            {hasTesterAttestation(test) && (
              <div className="result-subsection">
                <h5 className="result-subsection-title">Tester attestation</h5>
                <p className="result-consent-text">{TESTER_ATTESTATION_TEXT}</p>
                {TESTER_ATTESTATION_ITEMS.map((item) => (
                  test[item.key] !== undefined ? (
                    <ResultRow key={item.key} label={`${item.title}:`} value={test[item.key] ? 'Yes' : 'No'} />
                  ) : null
                ))}
                {medicalRestrictionsReceivedAnswer(test) !== undefined && (
                  <ResultRow
                    label="Medical restrictions received:"
                    value={medicalRestrictionsReceivedAnswer(test) ? 'Yes' : 'No'}
                  />
                )}
                {medicalRestrictionsReceivedAnswer(test) === true && test.testerMedicalRestrictionsNote ? (
                  <div className="result-consent-item">
                    <ResultRow wrap label="Restrictions received:" value={test.testerMedicalRestrictionsNote} />
                  </div>
                ) : null}
                {test.testerAttestationMedicalClearanceVerified !== undefined && (
                  <ResultRow
                    label="Medical clearance verified:"
                    value={test.testerAttestationMedicalClearanceVerified ? 'Yes' : 'No'}
                  />
                )}
              </div>
            )}

            {test.testerSignatureDataUrl && (
              <div className="signature-display-section">
                <div className="signature-display">
                  <span className="result-label">Tester signature:</span>
                  <div className="signature-image-container">
                    <img
                      src={test.testerSignatureDataUrl}
                      alt="Tester signature"
                      className="signature-image"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    )}

    <div className="show-all-wrap">
      <button
        onClick={() => onToggleExpand(test.id)}
        className="show-all-button"
      >
        {expanded ? '▼ Show Less' : '▶ Show All'}
      </button>
    </div>
  </div>
);

const ResultCard = ({
  test,
  user,
  editing,
  editData,
  saving,
  deleting,
  resending,
  pdfLoading,
  isCustomEditLocation,
  expanded,
  onToggleExpand,
  onEditChange,
  onEditSave,
  onEditCancel,
  onEditClick,
  onDeleteClick,
  onPreviewPdf,
  onDownloadPdf,
  onResend,
}) => {
  const isEditing = editing === test.id;
  const busy = deleting || resending === test.id || editing !== null || (pdfLoading && pdfLoading.id === test.id);

  return (
    <div className={`result-card ${isEditing ? 'editing' : ''}`}>
      <div className="result-card-header">
        {isEditing ? (
          <input
            type="text"
            className="edit-input edit-client-name"
            value={editData.clientName || ''}
            onChange={(e) => onEditChange('clientName', e.target.value)}
            placeholder="Client Name"
          />
        ) : (
          <h3 className="result-client-name">{test.clientName || 'N/A'}</h3>
        )}
        {isEditing ? (
          <select
            className="edit-select edit-result-badge"
            value={editData.result || 'Pass'}
            onChange={(e) => onEditChange('result', e.target.value)}
          >
            {RESULT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <span className={`result-badge ${test.result === 'Pass' ? 'pass' : 'fail'}`}>
            {test.result}
          </span>
        )}
      </div>
      {isEditing ? (
        <ResultCardEditForm
          editData={editData}
          onChange={onEditChange}
          isCustomEditLocation={isCustomEditLocation}
        />
      ) : (
        <ResultCardView
          test={test}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
        />
      )}
      <div className="result-card-footer">
        {isEditing ? (
          <>
            <button
              onClick={() => onEditSave(test.id)}
              className="save-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : '💾 Save'}
            </button>
            <button
              onClick={onEditCancel}
              className="cancel-button"
              disabled={saving}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => onEditClick(test)}
                  className="edit-button"
                  disabled={busy}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => onDeleteClick(test.id, test.clientName)}
                  className="delete-button"
                  disabled={busy}
                >
                  🗑️ Delete
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onPreviewPdf(test)}
              className="result-pdf-preview-button"
              disabled={busy || !test.clientName?.trim()}
              title={!test.clientName?.trim() ? 'Client name required for PDF' : 'Open PDF preview'}
            >
              {pdfLoading?.id === test.id && pdfLoading?.action === 'preview'
                ? 'Opening...'
                : 'Preview PDF'}
            </button>
            <button
              type="button"
              onClick={() => onDownloadPdf(test)}
              className="result-pdf-download-button"
              disabled={busy || !test.clientName?.trim()}
              title={!test.clientName?.trim() ? 'Client name required for PDF' : 'Download e-card as PDF'}
            >
              {pdfLoading?.id === test.id && pdfLoading?.action === 'download'
                ? 'Preparing...'
                : 'Download PDF'}
            </button>
            <button
              onClick={() => onResend(test)}
              className="resend-button"
              disabled={busy || !test.recipientEmail}
              title={!test.recipientEmail ? 'No recipient email available' : 'Resend e-card'}
            >
              {resending === test.id ? 'Sending...' : '📧 Resend'}
            </button>
            {user?.role !== 'admin' && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
                Only admin users can edit or delete test results.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ResultCard;
