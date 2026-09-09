import React, { useEffect, useRef } from 'react';
import FormSection from '../common/FormSection';
import FormInput from '../common/FormInput';
import FormYesNo from '../common/FormYesNo';
import SignaturePad from './SignaturePad';
import {
  LEGAL_HUB_URL,
  PUBLIC_POLICIES,
  PARTICIPANT_CONSENT_ITEMS,
  OPTIONAL_CONSENT_ITEMS,
  RECORD_DISCLAIMER,
  TESTER_ATTESTATION_TEXT,
} from '../../constants/consentCopy';

const ConsentChoice = ({
  id,
  checked,
  onChange,
  disabled,
  required,
  title,
  children,
  error,
  optional,
}) => (
  <div className={`consent-choice${optional ? ' consent-choice--optional' : ''}${children ? '' : ' consent-choice--compact'}`}>
    <label htmlFor={id} className="consent-choice-label">
      <input
        type="checkbox"
        id={id}
        className="form-checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="consent-choice-title">
          {title}
          {required ? <span className="consent-required"> *</span> : null}
          {optional ? <span className="consent-optional-tag">Optional</span> : null}
        </span>
        {children ? <span className="consent-choice-body">{children}</span> : null}
      </span>
    </label>
    {error ? <span className="form-error-message">{error}</span> : null}
  </div>
);

const SignatureSection = ({
  formData,
  onChange,
  isLoading,
  fieldErrors,
  onSignatureStroke,
  onSignatureClear,
  setSignatureCanvasRef,
  onTesterSignatureStroke,
  onTesterSignatureClear,
  setTesterSignatureCanvasRef,
}) => {
  const signaturePadRef = useRef(null);
  const testerSignaturePadRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (signaturePadRef.current && setSignatureCanvasRef) {
        const canvas = signaturePadRef.current.getCanvas();
        if (canvas) setSignatureCanvasRef(canvas);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [setSignatureCanvasRef]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (testerSignaturePadRef.current && setTesterSignatureCanvasRef) {
        const canvas = testerSignaturePadRef.current.getCanvas();
        if (canvas) setTesterSignatureCanvasRef(canvas);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [setTesterSignatureCanvasRef]);

  return (
    <FormSection title="Consent">
      <p className="consent-intro">
        Confirm required items with the participant. Optional items stay off unless they choose them.
      </p>

      <div className="consent-policy-box">
        <p className="consent-policy-heading">Policies</p>
        <p className="consent-text">
          Full copies:{' '}
          <a href={LEGAL_HUB_URL} target="_blank" rel="noopener noreferrer">
            next-leap-fit.vercel.app/legal
          </a>
        </p>
        <ul className="consent-policy-list">
          {PUBLIC_POLICIES.map((policy) => (
            <li key={policy.slug}>
              <a href={`${LEGAL_HUB_URL}/${policy.slug}`} target="_blank" rel="noopener noreferrer">
                {policy.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <h4 className="consent-subsection-title">Participant</h4>

      {PARTICIPANT_CONSENT_ITEMS.map((item) => (
        <ConsentChoice
          key={item.key}
          id={item.key}
          checked={formData[item.key]}
          onChange={(checked) => onChange(item.key, checked)}
          disabled={isLoading}
          required={item.required}
          title={item.title}
          error={fieldErrors?.[item.key]}
        >
          {item.key === 'privacyPolicyAcknowledged' ? (
            <>
              I have been given access to the{' '}
              <a href={`${LEGAL_HUB_URL}/privacy`} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              This is not consent to marketing, publicity, or unrestricted employer or school access.
            </>
          ) : (
            item.text
          )}
        </ConsentChoice>
      ))}

      <p className="consent-disclaimer">{RECORD_DISCLAIMER}</p>

      <h4 className="consent-subsection-title">Optional</h4>
      <p className="consent-optional-note">
        Declining these does not affect eligibility, price, or result.
      </p>

      {OPTIONAL_CONSENT_ITEMS.map((item) => (
        <React.Fragment key={item.key}>
          <ConsentChoice
            id={item.key}
            checked={formData[item.key]}
            onChange={(checked) => onChange(item.key, checked)}
            disabled={isLoading}
            optional
            title={item.title}
            error={fieldErrors?.[item.key]}
          >
            {item.text}
          </ConsentChoice>
          {item.key === 'optionalOrganizationRelease' && formData.optionalOrganizationRelease ? (
            <FormInput
              id="organizationReleaseRecipient"
              label="Named recipient"
              type="text"
              value={formData.organizationReleaseRecipient || ''}
              onChange={(e) => onChange('organizationReleaseRecipient', e.target.value)}
              placeholder="Employer, school, or verified destination"
              required
              disabled={isLoading}
              error={fieldErrors?.organizationReleaseRecipient}
            />
          ) : null}
        </React.Fragment>
      ))}

      <FormInput
        id="printedName"
        label="Printed name"
        type="text"
        value={formData.printedName || ''}
        onChange={(e) => onChange('printedName', e.target.value)}
        placeholder="Enter printed name"
        required
        disabled={isLoading}
        error={fieldErrors?.printedName}
      />

      <div className="signature-group">
        <label className="signature-label">
          Participant signature <span className="consent-required">*</span>
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

      <div className="tester-attestation">
        <h4 className="consent-subsection-title">Tester</h4>
        <div className="consent-statement">
          <p className="consent-text">{TESTER_ATTESTATION_TEXT}</p>
        </div>

        <ConsentChoice
          id="testerAttestationConsentWitnessed"
          checked={formData.testerAttestationConsentWitnessed !== undefined ? formData.testerAttestationConsentWitnessed : true}
          onChange={(checked) => onChange('testerAttestationConsentWitnessed', checked)}
          disabled={isLoading}
          required
          title="Client consent witnessed"
          error={fieldErrors?.testerAttestationConsentWitnessed}
        />

        <ConsentChoice
          id="testerAttestationProtocolFollowed"
          checked={formData.testerAttestationProtocolFollowed !== undefined ? formData.testerAttestationProtocolFollowed : true}
          onChange={(checked) => onChange('testerAttestationProtocolFollowed', checked)}
          disabled={isLoading}
          required
          title="Protocol followed"
          error={fieldErrors?.testerAttestationProtocolFollowed}
        />

        <ConsentChoice
          id="testerAttestationRespiratorMatchesRecord"
          checked={formData.testerAttestationRespiratorMatchesRecord !== undefined ? formData.testerAttestationRespiratorMatchesRecord : true}
          onChange={(checked) => onChange('testerAttestationRespiratorMatchesRecord', checked)}
          disabled={isLoading}
          required
          title="Respirator matches record"
          error={fieldErrors?.testerAttestationRespiratorMatchesRecord}
        />

        <FormYesNo
          name="testerMedicalRestrictionsReceived"
          label="Were medical restrictions received?"
          value={formData.testerMedicalRestrictionsReceived}
          onChange={(received) => {
            onChange('testerMedicalRestrictionsReceived', received);
            if (!received) onChange('testerMedicalRestrictionsNote', '');
          }}
          disabled={isLoading}
          required
          error={fieldErrors?.testerMedicalRestrictionsReceived}
        />

        {formData.testerMedicalRestrictionsReceived === true ? (
          <div className="form-group">
            <label htmlFor="testerMedicalRestrictionsNote">
              Restrictions received <span className="required-mark">*</span>
            </label>
            <textarea
              id="testerMedicalRestrictionsNote"
              className={`form-textarea ${fieldErrors?.testerMedicalRestrictionsNote ? 'form-input-error' : ''}`}
              value={formData.testerMedicalRestrictionsNote || ''}
              onChange={(e) => onChange('testerMedicalRestrictionsNote', e.target.value)}
              placeholder="Type the medical restrictions received"
              required
              disabled={isLoading}
              rows={3}
            />
            {fieldErrors?.testerMedicalRestrictionsNote ? (
              <span className="form-error-message">{fieldErrors.testerMedicalRestrictionsNote}</span>
            ) : null}
          </div>
        ) : null}

        <div className="signature-group">
          <label className="signature-label">
            Tester signature <span className="consent-required">*</span>
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
