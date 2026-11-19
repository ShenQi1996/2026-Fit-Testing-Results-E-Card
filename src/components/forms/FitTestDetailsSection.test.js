import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import FitTestDetailsSection from './FitTestDetailsSection';

const renderSection = () => {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(
      <FitTestDetailsSection
        formData={{ model: '', style: '', maskSize: '', respiratorMfg: '3M' }}
        onChange={() => {}}
        isLoading={false}
        fieldErrors={{}}
      />
    );
  });
  return renderer;
};

const rows = (renderer) => {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.props?.className === 'form-row') found.push(node);
    (Array.isArray(node.children) ? node.children : []).forEach(walk);
  };
  walk(renderer.toJSON());
  return found;
};

test('model is required and style sits beside it', () => {
  const renderer = renderSection();
  const modelRow = rows(renderer).find((row) => {
    const text = JSON.stringify(row);
    return text.includes('Model') && text.includes('Style');
  });

  expect(modelRow).toBeTruthy();
  const text = JSON.stringify(modelRow);
  expect(text).toContain('required-mark');
  expect(text).toContain('Cup (molded)');
  expect(text).toContain('Flat-fold');
  expect(text).toContain('Duckbill');
  expect(text).not.toContain('Mask size');

  act(() => {
    renderer.unmount();
  });
});
