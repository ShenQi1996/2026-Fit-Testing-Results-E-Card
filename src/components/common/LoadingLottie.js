import React from 'react';
import { LottieSvg } from 'lottie-react';
import loadingAnimation from '../../../public/loading.json';

// Loaded on demand by LoadingAnimation. LottieSvg is the svg-only lottie-web
// build. It keeps the expression engine, which loading.json uses, and svg was
// already the renderer the full build picked by default.
const LoadingLottie = () => (
  <LottieSvg
    src={loadingAnimation}
    loop
    autoplay
    className="loading-animation-lottie"
    aria-hidden="true"
  />
);

export default LoadingLottie;
