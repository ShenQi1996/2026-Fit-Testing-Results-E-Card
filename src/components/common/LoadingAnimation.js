import React from 'react';
import { Lottie } from 'lottie-react';
import loadingAnimation from '../../../public/loading.json';

const LoadingAnimation = ({ label = 'Loading…' }) => (
  <div className="loading-animation" role="status">
    <Lottie
      src={loadingAnimation}
      loop
      autoplay
      className="loading-animation-lottie"
      aria-hidden="true"
    />
    {label ? <p className="loading-animation-label">{label}</p> : null}
  </div>
);

export default LoadingAnimation;
