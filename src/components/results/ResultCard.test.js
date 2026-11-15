import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ResultCard from './ResultCard';

const renderCard = (test, { expanded = false } = {}) => {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(
      <ResultCard
        test={{ id: 'ft-1', clientName: 'Ada', issueDate: '01/15/2026', result: 'Pass', ...test }}
        user={{ uid: 'admin-1', role: 'admin' }}
        editing={null}
        editData={{}}
        expanded={expanded}
        onToggleExpand={() => {}}
      />
    );
  });
  return JSON.stringify(renderer.toJSON());
};

test('the in-app result card shows the stored fit factor for a legacy Quantitative record', () => {
  const html = renderCard({ fitTestMethod: 'Quantitative', fitFactor: 180 });
  expect(html).toContain('Fit Test Method:');
  expect(html).toContain('Quantitative');
  expect(html).toContain('Fit Factor:');
  expect(html).toContain('"180"');
});

test('the in-app result card shows no fit factor for qualitative records', () => {
  expect(renderCard({ fitTestMethod: 'Qualitative', fitFactor: 100 })).not.toContain('Fit Factor');
  expect(renderCard({})).not.toContain('Fit Factor');
  expect(renderCard({ fitTestMethod: 'Quantitative' })).not.toContain('Fit Factor');
});

test('the in-app result card shows the respirator style', () => {
  const html = renderCard({ style: 'Flat-fold' }, { expanded: true });
  expect(html).toContain('Style:');
  expect(html).toContain('Flat-fold');
});

test('a legacy result card with no style shows a dash', () => {
  const html = renderCard({ style: undefined }, { expanded: true });
  expect(html).toContain('Style:');
  expect(html).toContain('—');
});
