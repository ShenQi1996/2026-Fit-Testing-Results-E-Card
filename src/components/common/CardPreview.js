import React, { useEffect, useRef, useState } from 'react';
import { generateFitTestCard } from '../../utils/fitTestCardTemplate';
import './CardPreview.css';

const CARD_WIDTH = 800;

/** Inject only body markup so browsers don't rewrite a full HTML document inside a div. */
const extractPreviewMarkup = (html) => {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return (bodyMatch ? bodyMatch[1] : html).trim();
};

const CardPreview = ({ formData }) => {
  const previewHtml = extractPreviewMarkup(generateFitTestCard(formData));
  const wrapperRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return undefined;

    const updateMetrics = () => {
      const styles = window.getComputedStyle(wrapper);
      const paddingX =
        (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
      const availableWidth = Math.max(wrapper.clientWidth - paddingX, 120);
      const nextScale = Math.min(1, availableWidth / CARD_WIDTH);

      setScale(nextScale);
      // Prefer the 800px email card table height when available.
      const cardTable =
        content.querySelector('table[width="800"]') ||
        content.querySelector('table table') ||
        content.querySelector('table');
      const measuredHeight =
        (cardTable && (cardTable.offsetHeight || cardTable.scrollHeight)) ||
        content.offsetHeight ||
        content.scrollHeight ||
        0;
      setNaturalHeight(measuredHeight);
    };

    updateMetrics();

    const observer = new ResizeObserver(() => {
      updateMetrics();
    });
    observer.observe(wrapper);
    observer.observe(content);

    // Re-measure after QR/logo images load (Safari layout timing).
    const images = Array.from(content.querySelectorAll('img'));
    const onImageLoad = () => updateMetrics();
    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener('load', onImageLoad);
        img.addEventListener('error', onImageLoad);
      }
    });

    const timeoutIds = [50, 150, 300].map((delay) =>
      window.setTimeout(updateMetrics, delay)
    );

    return () => {
      observer.disconnect();
      timeoutIds.forEach((id) => window.clearTimeout(id));
      images.forEach((img) => {
        img.removeEventListener('load', onImageLoad);
        img.removeEventListener('error', onImageLoad);
      });
    };
  }, [previewHtml]);

  return (
    <div className="card-preview-container">
      <label className="form-label">E-Card Preview</label>
      <div className="card-preview-wrapper" ref={wrapperRef}>
        <div
          className="card-preview-viewport"
          style={{
            width: `${CARD_WIDTH * scale}px`,
            height: naturalHeight ? `${naturalHeight * scale}px` : undefined,
          }}
        >
          <div
            ref={contentRef}
            className="card-preview-content"
            style={{
              width: `${CARD_WIDTH}px`,
              transform: `scale(${scale})`,
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
};

export default CardPreview;
