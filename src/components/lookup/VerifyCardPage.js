import React, { useEffect, useMemo, useState } from 'react';
import { lookupFitTestForVerification } from '../../services/firebaseDb';
import {
  isValidVerificationToken,
  normalizeVerificationToken,
} from '../../utils/verificationToken';
import AuthPageShell, { AuthFooterLinks, AuthHomeLink } from '../common/AuthPageShell';
import LoadingAnimation from '../common/LoadingAnimation';
import VerifyAnimation from './VerifyAnimation';
import './VerifyCardPage.css';

const STATUS_COPY = {
  valid: {
    kicker: 'Verified record',
    title: 'This e-card is valid',
    subtitle: 'Secure Fit LLC confirms this fit-test record is on file and has not expired.',
  },
  expired: {
    kicker: 'Expired record',
    title: 'This e-card has expired',
    subtitle: 'This card was issued by Secure Fit LLC, but it is past its expiration date.',
  },
  failed: {
    kicker: 'Authentic record',
    title: 'This e-card did not pass',
    subtitle: 'Secure Fit LLC confirms this record, and the documented result is not a pass.',
  },
  invalid: {
    kicker: 'Verification',
    title: 'This e-card could not be verified',
    subtitle: 'No matching Secure Fit record was found for this code.',
  },
};

const DETAIL_FIELDS = [
  { key: 'clientName', label: 'Client name' },
  { key: 'issueDate', label: 'Issue date' },
  { key: 'expirationDate', label: 'Expiration date' },
  { key: 'result', label: 'Result' },
  { key: 'fitTestType', label: 'Fit test type' },
  { key: 'respiratorMfg', label: 'Respirator manufacturer' },
  { key: 'model', label: 'Model' },
  { key: 'maskSize', label: 'Mask size' },
  { key: 'fitTester', label: 'Fit tester' },
  { key: 'testLocation', label: 'Test location' },
];

const MIN_LOADING_MS = 600;

const VerifyCardPage = ({ initialToken = '' }) => {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [activeToken, setActiveToken] = useState(normalizeVerificationToken(initialToken));
  const [status, setStatus] = useState(initialToken ? 'loading' : 'idle');
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = normalizeVerificationToken(initialToken);
    setTokenInput(token);
    setActiveToken(token);
  }, [initialToken]);

  useEffect(() => {
    if (!activeToken) {
      setStatus('idle');
      setCard(null);
      setError('');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setError('');
    setCard(null);

    const startedAt = Date.now();

    lookupFitTestForVerification(activeToken)
      .then(async (result) => {
        const wait = MIN_LOADING_MS - (Date.now() - startedAt);
        if (wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
        if (cancelled) return;
        setStatus(result.status);
        setCard(result.card);
      })
      .catch(async (err) => {
        const wait = MIN_LOADING_MS - (Date.now() - startedAt);
        if (wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
        if (cancelled) return;
        setStatus('error');
        setCard(null);
        setError(err.message || 'Unable to verify the e-card right now. Please try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [activeToken]);

  const copy = useMemo(() => {
    if (status === 'idle') {
      return {
        kicker: 'Verify e-card',
        title: 'Confirm a Secure Fit e-card',
        subtitle: 'Scan the QR code on the e-card, or enter the verification code printed under it.',
      };
    }
    if (status === 'loading') {
      return {
        kicker: 'Verification',
        title: 'Checking this e-card',
        subtitle: 'Looking up the record issued by Secure Fit LLC.',
      };
    }
    if (status === 'error') {
      return {
        kicker: 'Verification',
        title: 'Unable to verify right now',
        subtitle: error,
      };
    }
    if (status === 'invalid' && error) {
      return {
        ...STATUS_COPY.invalid,
        subtitle: error,
      };
    }
    return STATUS_COPY[status] || STATUS_COPY.invalid;
  }, [error, status]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextToken = normalizeVerificationToken(tokenInput);
    if (!isValidVerificationToken(nextToken)) {
      setError('Enter the 32-character code from the e-card.');
      setStatus('invalid');
      setCard(null);
      setActiveToken('');
      return;
    }
    window.history.replaceState(null, '', `/verify/${nextToken}`);
    setActiveToken(nextToken);
  };

  return (
    <AuthPageShell cardClassName="verify-card">
      {status === 'loading' ? (
        <>
          <LoadingAnimation label="Checking this e-card" />
          <p className="auth-subtitle">Looking up the record issued by Secure Fit LLC.</p>
        </>
      ) : (
        <>
          {status === 'valid' && <VerifyAnimation />}
          <p className="auth-kicker">{copy.kicker}</p>
          <h2 className="auth-title">{copy.title}</h2>
          <p className="auth-subtitle">{copy.subtitle}</p>

          {status !== 'idle' && (status !== 'invalid' || activeToken) && (
            <div
              className={`verify-status-badge verify-status-badge--${status}`}
              role="status"
            >
              {status === 'valid' && 'Verified by Secure Fit LLC'}
              {status === 'expired' && 'Expired — issued by Secure Fit LLC'}
              {status === 'failed' && 'Authentic — did not pass'}
              {status === 'invalid' && 'Not found'}
              {status === 'error' && 'Try again shortly'}
            </div>
          )}

          {card && (status === 'valid' || status === 'expired' || status === 'failed') && (
            <dl className="verify-details">
              {DETAIL_FIELDS.map(({ key, label }) => (
                <div className="verify-details-row" key={key}>
                  <dt>{label}</dt>
                  <dd className={key === 'result' ? `verify-result verify-result--${(card.result || '').toLowerCase()}` : undefined}>
                    {card[key] || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {(!activeToken || status === 'invalid' || status === 'error' || status === 'idle') && (
            <form onSubmit={handleSubmit} className="auth-form">
              {status === 'error' && error && activeToken && (
                <div className="auth-error" role="alert">{error}</div>
              )}
              <div className="form-group">
                <label htmlFor="verify-token">Verification code</label>
                <input
                  type="text"
                  id="verify-token"
                  className="form-input verify-token-input"
                  placeholder="Paste the code from the e-card"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  inputMode="text"
                />
              </div>
              <button type="submit" className="auth-button" disabled={status === 'loading'}>
                Verify e-card
              </button>
            </form>
          )}

          <AuthFooterLinks>
            {(status === 'valid' || status === 'expired' || status === 'failed') && (
              <>
                <a href="/verify" className="auth-link">Check another e-card</a>
                <span> · </span>
              </>
            )}
            <a href="/resend" className="auth-link">Lost your e-card?</a>
            <span> · </span>
            <AuthHomeLink />
          </AuthFooterLinks>
        </>
      )}
    </AuthPageShell>
  );
};

export default VerifyCardPage;
