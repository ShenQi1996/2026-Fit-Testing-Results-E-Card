import React, { useState } from 'react';
import { draftUpdatedMs } from '../../services/fitTestDraftsDb';

export const DRAFT_BADGE_TEXT = 'DRAFT';
export const DRAFT_NOT_SENT_TEXT = 'Draft, not sent';

export const DraftBadge = () => (
  <span className="draft-badge" aria-label="Draft, not sent">{DRAFT_BADGE_TEXT}</span>
);

const formatSavedAt = (draft) => {
  const ms = draftUpdatedMs(draft);
  if (!ms) return 'Saving…';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const draftTitle = (draft) => (draft.clientName || '').trim() || 'Untitled draft';

/**
 * Lists the signed-in user's own unsent drafts at the top of the test result
 * form. One tap on a draft reopens it into the form.
 */
const FitTestDraftsPanel = ({
  drafts = [],
  isLoading = false,
  activeDraftId = null,
  disabled = false,
  onOpen,
  onDelete,
}) => {
  const [confirmingId, setConfirmingId] = useState(null);

  if (!isLoading && drafts.length === 0) return null;

  return (
    <section className="fit-test-drafts" aria-label="Your drafts">
      <div className="fit-test-drafts-header">
        <h2 className="fit-test-drafts-title">Your drafts</h2>
        <span className="fit-test-drafts-note">
          {DRAFT_NOT_SENT_TEXT}. Only you can see these.
        </span>
      </div>
      {isLoading && drafts.length === 0 ? (
        <p className="fit-test-drafts-loading">Loading drafts…</p>
      ) : (
        <ul className="fit-test-drafts-list">
          {drafts.map((draft) => {
            const active = draft.id === activeDraftId;
            const confirming = confirmingId === draft.id;
            return (
              <li
                key={draft.id}
                className={`fit-test-draft-item${active ? ' fit-test-draft-item--active' : ''}`}
              >
                <button
                  type="button"
                  className="fit-test-draft-open"
                  onClick={() => onOpen?.(draft.id)}
                  disabled={disabled}
                  aria-label={`Open draft for ${draftTitle(draft)}`}
                >
                  <DraftBadge />
                  <span className="fit-test-draft-name">{draftTitle(draft)}</span>
                  <span className="fit-test-draft-meta">
                    {(draft.recipientEmail || '').trim() || 'No recipient yet'}
                    {' · Saved '}
                    {formatSavedAt(draft)}
                    {active ? ' · Open now' : ''}
                  </span>
                </button>
                {confirming ? (
                  <span className="fit-test-draft-confirm">
                    <button
                      type="button"
                      className="fit-test-draft-delete-confirm"
                      onClick={() => {
                        setConfirmingId(null);
                        onDelete?.(draft.id);
                      }}
                      disabled={disabled}
                    >
                      Delete draft
                    </button>
                    <button
                      type="button"
                      className="fit-test-draft-delete-cancel"
                      onClick={() => setConfirmingId(null)}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="fit-test-draft-delete"
                    onClick={() => setConfirmingId(draft.id)}
                    disabled={disabled}
                    aria-label={`Delete draft for ${draftTitle(draft)}`}
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/** Shown above the form while a draft is open, so it can't pass for a sent result. */
export const DraftBanner = ({ onStartNew, disabled = false }) => (
  <div className="draft-banner" role="status">
    <DraftBadge />
    <span className="draft-banner-text">
      <strong>{DRAFT_NOT_SENT_TEXT}.</strong>
      {' '}This result has not been emailed or recorded. Send it below when it is complete.
    </span>
    {onStartNew && (
      <button
        type="button"
        className="draft-banner-new"
        onClick={onStartNew}
        disabled={disabled}
      >
        Start a new form
      </button>
    )}
  </div>
);

export default FitTestDraftsPanel;
