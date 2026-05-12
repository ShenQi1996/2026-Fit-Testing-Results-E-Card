import React, { useEffect, useRef } from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import SignaturePad from './SignaturePad';

const SignatureSection = ({ formData, onChange, isLoading, fieldErrors, onSignatureStroke, onSignatureClear, setSignatureCanvasRef, onTesterSignatureStroke, onTesterSignatureClear, setTesterSignatureCanvasRef }) => {
  const signaturePadRef = useRef(null);
  const testerSignaturePadRef = useRef(null);

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

  useEffect(() => {
    // Set the tester signature canvas ref
    const timer = setTimeout(() => {
      if (testerSignaturePadRef.current && setTesterSignatureCanvasRef) {
        const canvas = testerSignaturePadRef.current.getCanvas();
        if (canvas) {
          setTesterSignatureCanvasRef(canvas);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [setTesterSignatureCanvasRef]);

  return (
    <FormSection title="Consent">
      {/* Student Clearance Subsection */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: '12px' }}>Student clearance</h4>
        <div className="form-group">
          <label htmlFor="studentClearanceConfirmed" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="studentClearanceConfirmed"
              checked={formData.studentClearanceConfirmed || false}
              onChange={(e) => onChange('studentClearanceConfirmed', e.target.checked)}
              disabled={isLoading}
              style={{
                width: '18px',
                height: '18px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                accentColor: 'var(--accent-teal)',
                marginTop: '2px',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 500 }}>Student clearance confirmed <span style={{ color: '#dc3545' }}>*</span></span>
              <div className="consent-statement" style={{ marginTop: '8px' }}>
                <p className="consent-text">
                  By signing below, I confirm that I am an active nursing student participating in clinical placement and that I have completed the required medical evaluation and are medically cleared for respirator use in accordance with OSHA respiratory protection requirements.
                </p>
              </div>
            </div>
          </label>
          {fieldErrors?.studentClearanceConfirmed && (
            <span className="form-error-message">{fieldErrors.studentClearanceConfirmed}</span>
          )}
        </div>
      </div>

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

      {/* Tester Attestation Subsection */}
      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '2px solid var(--border-color)' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: '12px' }}>Tester attestation</h4>
        <div className="consent-statement" style={{ marginBottom: '16px' }}>
          <p className="consent-text">
            I attest that I verified documented medical clearance for respirator use prior to performing this fit test. I performed this qualitative respirator fit test in accordance with established procedures and followed the required test protocol. I confirm that sensitivity screening was completed when applicable and that the respirator manufacturer model style and size recorded on this form match the respirator used during testing. I further attest that this record is complete, accurate, and created under my authenticated user account.
          </p>
        </div>

        {/* Tester Attestation Checkboxes */}
        <div style={{ marginBottom: '20px' }}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label htmlFor="testerAttestationProtocolFollowed" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="testerAttestationProtocolFollowed"
                checked={formData.testerAttestationProtocolFollowed !== undefined ? formData.testerAttestationProtocolFollowed : true}
                onChange={(e) => onChange('testerAttestationProtocolFollowed', e.target.checked)}
                disabled={isLoading}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  accentColor: 'var(--accent-teal)',
                  marginTop: '2px',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 500 }}>Protocol followed <span style={{ color: '#dc3545' }}>*</span></span>
            </label>
            {fieldErrors?.testerAttestationProtocolFollowed && (
              <span className="form-error-message">{fieldErrors.testerAttestationProtocolFollowed}</span>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label htmlFor="testerAttestationMedicalClearanceVerified" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="testerAttestationMedicalClearanceVerified"
                checked={formData.testerAttestationMedicalClearanceVerified !== undefined ? formData.testerAttestationMedicalClearanceVerified : true}
                onChange={(e) => onChange('testerAttestationMedicalClearanceVerified', e.target.checked)}
                disabled={isLoading}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  accentColor: 'var(--accent-teal)',
                  marginTop: '2px',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 500 }}>Medical clearance verified <span style={{ color: '#dc3545' }}>*</span></span>
            </label>
            {fieldErrors?.testerAttestationMedicalClearanceVerified && (
              <span className="form-error-message">{fieldErrors.testerAttestationMedicalClearanceVerified}</span>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label htmlFor="testerAttestationRespiratorMatchesRecord" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="testerAttestationRespiratorMatchesRecord"
                checked={formData.testerAttestationRespiratorMatchesRecord !== undefined ? formData.testerAttestationRespiratorMatchesRecord : true}
                onChange={(e) => onChange('testerAttestationRespiratorMatchesRecord', e.target.checked)}
                disabled={isLoading}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  accentColor: 'var(--accent-teal)',
                  marginTop: '2px',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 500 }}>Respirator matches record <span style={{ color: '#dc3545' }}>*</span></span>
            </label>
            {fieldErrors?.testerAttestationRespiratorMatchesRecord && (
              <span className="form-error-message">{fieldErrors.testerAttestationRespiratorMatchesRecord}</span>
            )}
          </div>
        </div>
        
        <div className="signature-group">
          <label className="signature-label">
            Tester Signature <span style={{ color: '#dc3545' }}>*</span>
          </label>
          <SignaturePad
            ref={testerSignaturePadRef}
            onStroke={onTesterSignatureStroke}
            onClear={onTesterSignatureClear}
            disabled={isLoading}
          />
          {fieldErrors?.testerSignature && (
            <span className="form-error-message">{fieldErrors.testerSignature}</span>
          )}
        </div>
      </div>
    </FormSection>
  );
};

export default SignatureSection;