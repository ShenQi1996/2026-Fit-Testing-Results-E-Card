import React from 'react';
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
import SubmitButton from './SubmitButton';
import './FitTestForm.css';

const FitTestForm = () => {
  const {
    formData,
    isLoading,
    status,
    fieldErrors,
    hasStrokes,
    hasTesterStrokes,
    handleInputChange,
    handleSubmit,
    handleSignatureStroke,
    handleSignatureClear,
    handleTesterSignatureStroke,
    handleTesterSignatureClear,
    setSignatureCanvasRef,
    setTesterSignatureCanvasRef,
  } = useFitTestForm();

  return (
    <form className="fit-test-form" onSubmit={handleSubmit}>
      <RecipientInfoSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
      />

      <ClientInfoSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
      />

      <FitTestDetailsSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
      />

      <RespiratoryProtectionProgramSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
      />

      <FitTestInvalidationSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
      />

      <SensitivityScreeningSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
      />

      <ExerciseChecklistSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
      />

      <EquipmentHygieneSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
      />

      <SignatureSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
        onSignatureStroke={handleSignatureStroke}
        onSignatureClear={handleSignatureClear}
        setSignatureCanvasRef={setSignatureCanvasRef}
        onTesterSignatureStroke={handleTesterSignatureStroke}
        onTesterSignatureClear={handleTesterSignatureClear}
        setTesterSignatureCanvasRef={setTesterSignatureCanvasRef}
      />

      <CardPreview formData={formData} />

      {/* Display all validation errors */}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="validation-errors-summary">
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#dc3545' }}>
            Please fix the following errors:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#dc3545' }}>
            {Object.values(fieldErrors).map((error, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <StatusMessage type={status.type} message={status.message} />

      <div className="submit-button-container">
        <SubmitButton 
          isLoading={isLoading} 
          disabled={
            !formData.printedName?.trim() || 
            !hasStrokes || 
            !formData.studentClearanceConfirmed || 
            !hasTesterStrokes ||
            formData.testerAttestationProtocolFollowed === false ||
            formData.testerAttestationMedicalClearanceVerified === false ||
            formData.testerAttestationRespiratorMatchesRecord === false
          }
        />
      </div>
    </form>
  );
};

export default FitTestForm;
