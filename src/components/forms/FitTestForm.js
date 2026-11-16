import React, { useEffect, useState } from 'react';
import { useFitTestForm } from '../../hooks/useFitTestForm';
import CardPreview from '../common/CardPreview';
import RecipientInfoSection from './RecipientInfoSection';
import ClientInfoSection from './ClientInfoSection';
import FitTestDetailsSection from './FitTestDetailsSection';
import RespiratoryProtectionProgramSection from './RespiratoryProtectionProgramSection';
import FitTestInvalidationSection from './FitTestInvalidationSection';
import SensitivityScreeningSection from './SensitivityScreeningSection';
import ExerciseChecklistSection from './ExerciseChecklistSection';
import EquipmentHygieneSection from './EquipmentHygieneSection';
import SignatureSection from './SignatureSection';
import StatusMessage from '../common/StatusMessage';
import SubmitButton, { SaveWithoutSendButton } from './SubmitButton';
import FitTestDraftsPanel, { DraftBadge, DraftBanner } from './FitTestDraftsPanel';
import {
  downloadFitTestPdf,
  prefetchPdfLibraries,
  previewFitTestPdf,
  schedulePdfPrefetch,
} from '../../utils/pdfUtils';
import './FitTestForm.css';

const FitTestForm = () => {
  const {
    formData,
    isLoading,
    isSavingWithoutSend,
    status,
    fieldErrors,
    solutionTypeOptions,
    selectedSolutionOption,
    setSolutionProfileAsDefault,
    isLoadingSolutionProfiles,
    schoolOptions,
    schoolLocked,
    schoolBlockedMessage,
    schoolSubmitBlocked,
    isLoadingSchoolProfiles,
    hasStrokes,
    hasTesterStrokes,
    handleInputChange,
    handleSolutionOptionChange,
    handleSchoolOptionChange,
    setSetSolutionProfileAsDefault,
    isAddingNewSolutionProfile,
    handleSubmit,
    handleSaveWithoutSend,
    handleSignatureStroke,
    handleSignatureClear,
    handleTesterSignatureStroke,
    handleTesterSignatureClear,
    setSignatureCanvasRef,
    setTesterSignatureCanvasRef,
    resetForm,
    canUseDrafts,
    drafts,
    draftsLoading,
    activeDraftId,
    isSavingDraft,
    handleSaveDraft,
    handleOpenDraft,
    handleDeleteDraft,
  } = useFitTestForm();

  const isDraft = Boolean(activeDraftId);
  const busy = isLoading || isSavingDraft || isSavingWithoutSend;

  const [pdfStatus, setPdfStatus] = useState({ type: '', message: '' });

  useEffect(() => schedulePdfPrefetch(), []);

  const handleDownloadPdf = async () => {
    setPdfStatus({ type: '', message: '' });
    try {
      await downloadFitTestPdf(formData);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setPdfStatus({ type: 'error', message: 'Could not create the PDF. Please try again.' });
    }
  };

  // Not async on purpose: previewFitTestPdf must run synchronously inside the
  // click so Safari lets it open the preview tab.
  const handlePreviewPdf = () => {
    setPdfStatus({ type: '', message: '' });
    return previewFitTestPdf(formData)
      .then((result) => {
        if (result?.mode === 'download' && result.message) {
          setPdfStatus({ type: 'warning', message: result.message });
        }
      })
      .catch((err) => {
        console.error('Error previewing PDF:', err);
        setPdfStatus({ type: 'error', message: 'Could not create the PDF preview. Please try again.' });
      });
  };

  const pdfPrefetchProps = {
    onPointerEnter: prefetchPdfLibraries,
    onFocus: prefetchPdfLibraries,
    onTouchStart: prefetchPdfLibraries,
  };

  const fieldProps = { formData, onChange: handleInputChange, isLoading, fieldErrors };

  return (
    <div className="fit-test-form-page">
      {canUseDrafts && (
        <FitTestDraftsPanel
          drafts={drafts}
          isLoading={draftsLoading}
          activeDraftId={activeDraftId}
          disabled={busy}
          onOpen={handleOpenDraft}
          onDelete={handleDeleteDraft}
        />
      )}
      <form
        className={`fit-test-form${isDraft ? ' fit-test-form--draft' : ''}`}
        onSubmit={handleSubmit}
        data-draft={isDraft ? 'true' : 'false'}
      >
        {isDraft && <DraftBanner onStartNew={resetForm} disabled={busy} />}

        <RecipientInfoSection {...fieldProps} />

        <ClientInfoSection {...fieldProps} />

        <FitTestDetailsSection {...fieldProps} />

        <RespiratoryProtectionProgramSection
          {...fieldProps}
          schoolOptions={schoolOptions}
          onSchoolOptionChange={handleSchoolOptionChange}
          schoolLocked={schoolLocked}
          schoolBlockedMessage={schoolBlockedMessage}
          isLoadingSchoolProfiles={isLoadingSchoolProfiles}
        />

        <FitTestInvalidationSection {...fieldProps} />

        <SensitivityScreeningSection {...fieldProps} />

        <ExerciseChecklistSection {...fieldProps} />

        <EquipmentHygieneSection
          {...fieldProps}
          solutionTypeOptions={solutionTypeOptions}
          selectedSolutionOption={selectedSolutionOption}
          onSolutionOptionChange={handleSolutionOptionChange}
          setSolutionProfileAsDefault={setSolutionProfileAsDefault}
          onSetSolutionProfileAsDefaultChange={setSetSolutionProfileAsDefault}
          isAddingNewSolutionProfile={isAddingNewSolutionProfile}
          isLoadingSolutionProfiles={isLoadingSolutionProfiles}
        />

        <SignatureSection
          {...fieldProps}
          onSignatureStroke={handleSignatureStroke}
          onSignatureClear={handleSignatureClear}
          setSignatureCanvasRef={setSignatureCanvasRef}
          onTesterSignatureStroke={handleTesterSignatureStroke}
          onTesterSignatureClear={handleTesterSignatureClear}
          setTesterSignatureCanvasRef={setTesterSignatureCanvasRef}
        />

        {isDraft ? (
          <div className="card-preview-draft">
            <div className="card-preview-draft-label">
              <DraftBadge /> Preview only. Draft, not sent.
            </div>
            <CardPreview formData={formData} />
          </div>
        ) : (
          <CardPreview formData={formData} />
        )}

        {Object.keys(fieldErrors).length > 0 && (
          <div className="validation-errors-summary">
            <div className="validation-errors-summary-title">
              Please fix the following errors:
            </div>
            <ul>
              {Object.values(fieldErrors).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <StatusMessage type={status.type} message={status.message} />
        <StatusMessage type={pdfStatus.type} message={pdfStatus.message} />

        <div className="submit-button-container">
          <button
            type="button"
            className="preview-pdf-button"
            onClick={handlePreviewPdf}
            {...pdfPrefetchProps}
            disabled={!formData.clientName?.trim() || isLoading}
          >
            Preview PDF
          </button>
          <button
            type="button"
            className="download-pdf-button"
            onClick={handleDownloadPdf}
            {...pdfPrefetchProps}
            disabled={!formData.clientName?.trim() || isLoading}
          >
            Download PDF
          </button>
          {canUseDrafts && (
            <button
              type="button"
              className="save-draft-button"
              onClick={handleSaveDraft}
              disabled={busy}
            >
              {isSavingDraft ? 'Saving draft…' : isDraft ? 'Update draft' : 'Save as draft'}
            </button>
          )}
          <SaveWithoutSendButton
            isSaving={isSavingWithoutSend}
            onClick={handleSaveWithoutSend}
            disabled={
              schoolSubmitBlocked ||
              !formData.printedName?.trim() ||
              !hasStrokes ||
              !formData.studentClearanceConfirmed ||
              !formData.consentToFitTest ||
              !formData.privacyPolicyAcknowledged ||
              !formData.recordDeliveryConfirmed ||
              (formData.optionalOrganizationRelease && !formData.organizationReleaseRecipient?.trim()) ||
              !hasTesterStrokes ||
              formData.testerAttestationProtocolFollowed === false ||
              formData.testerAttestationConsentWitnessed === false ||
              formData.testerAttestationRespiratorMatchesRecord === false ||
              (formData.testerMedicalRestrictionsReceived !== true && formData.testerMedicalRestrictionsReceived !== false) ||
              (formData.testerMedicalRestrictionsReceived === true && !formData.testerMedicalRestrictionsNote?.trim()) ||
              !formData.model?.trim() ||
              !formData.style?.trim() ||
              busy
            }
          />
          <SubmitButton 
            isLoading={isLoading}
            disabled={
              schoolSubmitBlocked ||
              !formData.printedName?.trim() || 
              !hasStrokes || 
              !formData.studentClearanceConfirmed ||
              !formData.consentToFitTest ||
              !formData.privacyPolicyAcknowledged ||
              !formData.recordDeliveryConfirmed ||
              (formData.optionalOrganizationRelease && !formData.organizationReleaseRecipient?.trim()) ||
              !hasTesterStrokes ||
              formData.testerAttestationProtocolFollowed === false ||
              formData.testerAttestationConsentWitnessed === false ||
              formData.testerAttestationRespiratorMatchesRecord === false ||
              (formData.testerMedicalRestrictionsReceived !== true && formData.testerMedicalRestrictionsReceived !== false) ||
              (formData.testerMedicalRestrictionsReceived === true && !formData.testerMedicalRestrictionsNote?.trim()) ||
              !formData.model?.trim() ||
              !formData.style?.trim() ||
              busy
            }
          />
        </div>
      </form>
    </div>
  );
};

export default FitTestForm;
