/* global process */
import React from 'react';
import './StagingBanner.css';

const StagingBanner = () => {
  if (process.env.APP_ENV !== 'staging') return null;

  return (
    <div className="staging-banner" role="status">
      STAGING
    </div>
  );
};

export default StagingBanner;
