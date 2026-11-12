import { buildFitTestsCsv } from './csvUtils';
import { resolveAppRoute } from './appRoute';

describe('formatting and route helpers', () => {
  test('buildFitTestsCsv quotes commas, quotes, and newlines', () => {
    const csv = buildFitTestsCsv([
      {
        clientName: 'Doe, Jane',
        result: 'Pass "A"',
        correctiveActionNote: 'line one\nline two',
      },
    ]);

    expect(csv.startsWith('Client Name,DOB,Issue Date,Expiration Date,')).toBe(true);
    expect(csv).toContain('Fit Test Method');
    expect(csv).not.toContain('Fit Factor');
    expect(csv).toContain('Qualitative');
    expect(csv).toContain('"Doe, Jane"');
    expect(csv).toContain('"Pass ""A"""');
    expect(csv).toContain('"line one\nline two"');
  });

  test('resolveAppRoute tags staff, resend, verify, and home paths', () => {
    expect(resolveAppRoute('/staff_login').kind).toBe('staff');
    expect(resolveAppRoute('/resend/').kind).toBe('resend');
    expect(resolveAppRoute('/verify/abc')).toEqual({
      kind: 'verify',
      path: '/verify/abc',
      token: 'abc',
    });
    expect(resolveAppRoute('/').kind).toBe('home');
  });
});
