import React, { useEffect, useRef } from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import SignaturePad from './SignaturePad';

const SignatureSection = ({ formData, onChange, isLoading, fieldErrors, onSignatureStroke, onSignatureClear, setSignatureCanvasRef }) => {
  const signaturePadRef = useRef(null);

  useEffect(() => {
    // Set the canvas ref when the component mounts or when signaturePadRef becomes available
    const timer = setTimeout(() => {
      if (signaturePadRef.current && setSignatureCanvasRef) {
        const canvas = signaturePadRef.current.getCanvas();
        if (canvas) {
          setSignatureCanvasRef(canvas);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [setSignatureCanvasRef]);

  return (
    <FormSection title="Consent">
      <FormInput
        id="printedName"
        label="Printed Name"
        type="text"
        value={formData.printedName || ''}
        onChange={(e) => onChange('printedName', e.target.value)}
        placeholder="Enter your printed name"
        required
        disabled={isLoading}
        error={fieldErrors?.printedName}
      />
      
      {/* Consent Statement */}
      <div className="consent-statement">
        <p className="consent-text">
          By signing below I confirm that I am an active nursing student participating in clinical placement and that my medical clearance has been completed through my nursing program.
        </p>
      </div>
      
      <div className="signature-group">
        <label className="signature-label">
          Signature <span style={{ color: '#dc3545' }}>*</span>
        </label>
        <SignaturePad
          ref={signaturePadRef}
          onStroke={onSignatureStroke}
          onClear={onSignatureClear}
          disabled={isLoading}
        />
        {fieldErrors?.signature && (
          <span className="form-error-message">{fieldErrors.signature}</span>
        )}
      </div>
    </FormSection>
  );
};

export default SignatureSection;