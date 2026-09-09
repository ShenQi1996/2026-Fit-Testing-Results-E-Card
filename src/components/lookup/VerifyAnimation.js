import React from 'react';
import { Lottie } from 'lottie-react';
import verificationAnimation from '../../../public/verification.json';

const VerifyAnimation = () => (
  <div className="verify-animation">
    <Lottie
      src={verificationAnimation}
      loop={false}
      autoplay
      className="verify-animation-lottie"
      aria-hidden="true"
    />
  </div>
);

export default VerifyAnimation;
