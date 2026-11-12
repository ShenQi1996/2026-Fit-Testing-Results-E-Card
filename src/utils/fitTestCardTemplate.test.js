import { generateFitTestCard } from './fitTestCardTemplate';

test('the e-card shows a missing or legacy method as Qualitative and has no fit factor', () => {
  const blank = generateFitTestCard({ clientName: 'Ada' });
  expect(blank).toContain('Qualitative');
  expect(blank).not.toContain('[Method]');
  expect(blank).not.toContain('[Style]');
  expect(blank).not.toContain('Fit Factor');
  expect(blank).not.toContain('[Fit factor]');

  const legacy = generateFitTestCard({
    clientName: 'Ada',
    fitTestMethod: 'Locked to Qualitative',
    fitFactor: 100,
  });
  expect(legacy).toContain('Qualitative');
  expect(legacy).not.toContain('Locked to Qualitative');
  expect(legacy).not.toContain('Fit Factor');
  expect(legacy).not.toContain('[Method]');
});

test('the emailed e-card does not print program administrator fields', () => {
  const html = generateFitTestCard({
    clientName: 'Ada',
    programAdministratorName: 'Ada Admin',
    programAdministratorContact: 'ada-admin@example.com',
  });
  expect(html).not.toContain('Ada Admin');
  expect(html).not.toContain('ada-admin@example.com');
  expect(html).not.toContain('Program Administrator');
});
