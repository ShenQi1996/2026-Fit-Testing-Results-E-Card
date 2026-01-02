import React from 'react';
import { useEmailForm } from '../../hooks/useEmailForm';
import CardPreview from '../common/CardPreview';
import RecipientInfoSection from './RecipientInfoSection';
import ClientInfoSection from './ClientInfoSection';
import FitTestDetailsSection from './FitTestDetailsSection';
import StatusMessage from '../common/StatusMessage';
import SubmitButton from './SubmitButton';
import '../common/EmailForm.css';

const EmailForm = () => {
  const {
    formData,
    isLoading,
    status,
    fieldErrors,
    handleInputChange,
    handleSubmit,
    handleTestSave,
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

      <CardPreview formData={formData} />

      <StatusMessage type={status.type} message={status.message} />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SubmitButton isLoading={isLoading} />
        <button 
          type="button" 
          onClick={handleTestSave}
          style={{
            background: 'linear-gradient(135deg, #20b2aa 0%, #17a2b8 100%)',
            color: 'white',
            border: 'none',
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginTop: '8px',
            opacity: isLoading ? 0.6 : 1
          }}
          disabled={isLoading}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(32, 178, 170, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          {isLoading ? 'Saving...' : 'Test Save to Firebase'}
        </button>
      </div>
    </form>
  );
};

export default EmailForm;

