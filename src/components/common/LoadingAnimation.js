import React, { Suspense, lazy } from 'react';

const LoadingLottie = lazy(() => import(/* webpackChunkName: "lottie-loading" */ './LoadingLottie'));

// Same-size placeholder while the animation chunk downloads, so the label
// does not jump when the animation appears.
const LottiePlaceholder = () => (
  <div className="loading-animation-lottie loading-animation-placeholder" aria-hidden="true">
    <span className="page-loading-spinner" />
  </div>
);

const LoadingAnimation = ({ label = 'Loading…' }) => (
  <div className="loading-animation" role="status">
    <Suspense fallback={<LottiePlaceholder />}>
      <LoadingLottie />
    </Suspense>
    {label ? <p className="loading-animation-label">{label}</p> : null}
  </div>
);

export default LoadingAnimation;
