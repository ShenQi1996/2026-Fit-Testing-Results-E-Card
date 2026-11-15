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

test('a legacy Quantitative e-card prints its stored fit factor', () => {
  const html = generateFitTestCard({
    clientName: 'Ada',
    fitTestMethod: 'Quantitative',
    fitFactor: 180,
  });
  expect(html).toContain('Quantitative');
  expect(html).toContain('Fit Factor:');
  expect(html).toMatch(/Fit Factor:<\/td>\s*<td[^>]*>180<\/td>/);

  const noFactor = generateFitTestCard({ clientName: 'Ada', fitTestMethod: 'Quantitative' });
  expect(noFactor).not.toContain('Fit Factor');

  const escaped = generateFitTestCard({
    clientName: 'Ada',
    fitTestMethod: 'Quantitative',
    fitFactor: '<b>99</b>',
  });
  expect(escaped).toContain('&lt;b&gt;99&lt;/b&gt;');
  expect(escaped).not.toContain('<b>99</b>');
});

test('the emailed e-card prints the respirator style, HTML-escaped', () => {
  const html = generateFitTestCard({ clientName: 'Ada', style: 'Cup (molded)' });
  expect(html).toContain('Style:');
  expect(html).toContain('Cup (molded)');

  const hostile = generateFitTestCard({ clientName: 'Ada', style: '<img src=x onerror=alert(1)>' });
  expect(hostile).not.toContain('<img src=x');
  expect(hostile).toContain('&lt;img src=x onerror=alert(1)&gt;');
});

test('a legacy e-card with no style has no Style row', () => {
  const html = generateFitTestCard({ clientName: 'Ada' });
  expect(html).not.toContain('Style:');
});
