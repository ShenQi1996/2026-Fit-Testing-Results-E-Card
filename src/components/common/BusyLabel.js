import React from 'react';

// Inline spinner for a button that is saving. Same CSS spinner as the page
// Suspense fallback (PageLoading), sized for a button. No Lottie.
export const ButtonSpinner = () => (
  <span className="button-spinner" aria-hidden="true" />
);

/**
 * Button content: `label` when idle, the spinner plus `busyText` while busy.
 * Returns plain children (not a wrapper element) so the text stays a direct
 * child of the button.
 */
export const busyContent = (busy, busyText, label) => (
  busy ? [<ButtonSpinner key="spinner" />, busyText] : label
);
