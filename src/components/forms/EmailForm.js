import React from 'react';
import { useEmailForm } from '../../hooks/useEmailForm';
import CardPreview from '../common/CardPreview';
import RecipientInfoSection from './RecipientInfoSection';
import ClientInfoSection from './ClientInfoSection';
import FitTestDetailsSection from './FitTestDetailsSection';
import SignatureSection from './SignatureSection';
import StatusMessage from '../common/StatusMessage';
import SubmitButton from './SubmitButton';
import '../common/EmailForm.css';

const EmailForm = () => {
  const {
    formData,
    isLoading,
    status,
    fieldErrors,
    hasStrokes,
    handleInputChange,
    handleSubmit,
    handleSignatureStroke,
    handleSignatureClear,
    setSignatureCanvasRef,
  } = useEmailForm();

  return (
    <form className="email-form" onSubmit={handleSubmit}>
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

      <SignatureSection
        formData={formData}
        onChange={handleInputChange}
        isLoading={isLoading}
        fieldErrors={fieldErrors}
        onSignatureStroke={handleSignatureStroke}
        onSignatureClear={handleSignatureClear}
        setSignatureCanvasRef={setSignatureCanvasRef}
      />

      <CardPreview formData={formData} />

      <StatusMessage type={status.type} message={status.message} />

      <div className="submit-button-container">
        <SubmitButton 
          isLoading={isLoading} 
          disabled={!formData.printedName?.trim() || !hasStrokes}
        />
      </div>
    </form>
  );
};

export default EmailForm;