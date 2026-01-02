import React from 'react';
import { generateFitTestCard } from '../../utils/ecardTemplates';
import './CardPreview.css';

const CardPreview = ({ formData }) => {
  const previewHtml = generateFitTestCard(formData);

  return (
    <div className="card-preview-container">
      <label className="form-label">E-Card Preview</label>
      <div className="card-preview-wrapper">
        <div 
          className="card-preview-content"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  );
};

export default CardPreview;

