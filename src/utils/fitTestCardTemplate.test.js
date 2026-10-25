import { generateFitTestCard } from './fitTestCardTemplate';

test('the e-card does not print method placeholders and shows the legacy label as Qualitative', () => {
  const blank = generateFitTestCard({ clientName: 'Ada' });
  expect(blank).not.toContain('[Method]');
  expect(blank).not.toContain('[Style]');
  expect(blank).not.toContain('[Fit factor]');

  const legacy = generateFitTestCard({
    clientName: 'Ada',
    fitTestMethod: 'Locked to Qualitative',
  });
  expect(legacy).toContain('Qualitative');
  expect(legacy).not.toContain('Locked to Qualitative');
  expect(legacy).not.toContain('[Method]');
});
