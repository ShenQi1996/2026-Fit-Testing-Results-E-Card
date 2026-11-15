import React from 'react';

// Shown while a page's code chunk downloads. Plain markup and CSS only, so it
// never waits on the Lottie engine or another chunk.
const PageLoading = ({ label = 'Loading…' }) => (
  <div className="page-loading" role="status" aria-live="polite">
    <span className="page-loading-spinner" aria-hidden="true" />
    {label ? <p className="page-loading-label">{label}</p> : null}
  </div>
);

export default PageLoading;
