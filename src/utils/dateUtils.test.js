import {
  calculateExpirationDate,
  formatDateInput,
  getFitTestRetentionDate,
  isExpirationDatePast,
  isFitTestPastRetention,
  parseDateString,
} from './dateUtils';

describe('date helpers', () => {
  test('formatDateInput inserts slashes and ignores extra characters', () => {
    expect(formatDateInput('')).toBe('');
    expect(formatDateInput('1')).toBe('1');
    expect(formatDateInput('0115')).toBe('01/15');
    expect(formatDateInput('01/15/2026abc')).toBe('01/15/2026');
    expect(formatDateInput('0115202699')).toBe('01/15/2026');
  });

  test('parseDateString reads MM/DD/YYYY and rejects incomplete values', () => {
    const parsed = parseDateString('01/15/2026');
    expect(parsed).toEqual(new Date(2026, 0, 15));
    expect(parseDateString('')).toBeNull();
    expect(parseDateString('2026-01-15')).toBeNull();
    expect(parseDateString('01/15')).toBeNull();
  });

  test('calculateExpirationDate adds one calendar year', () => {
    expect(calculateExpirationDate('01/15/2026')).toBe('01/15/2027');
    expect(calculateExpirationDate('02/29/2024')).toBe('03/01/2025');
    expect(calculateExpirationDate('')).toBe('');
    expect(calculateExpirationDate('not-a-date')).toBe('');
  });

  test('isExpirationDatePast stays false through the end of the expiration day', () => {
    const duringExpirationDay = new Date(2026, 0, 15, 23, 59, 59, 999);
    const afterExpirationDay = new Date(2026, 0, 16, 0, 0, 0, 0);

    expect(isExpirationDatePast('01/15/2026', duringExpirationDay)).toBe(false);
    expect(isExpirationDatePast('01/15/2026', afterExpirationDay)).toBe(true);
    expect(isExpirationDatePast('', afterExpirationDay)).toBe(false);
  });

  test('isFitTestPastRetention uses a three-year window and keeps undated records', () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);

    expect(isFitTestPastRetention({ issueDate: '06/14/2023' }, now)).toBe(true);
    expect(isFitTestPastRetention({ issueDate: '06/15/2023' }, now)).toBe(false);
    expect(isFitTestPastRetention({ issueDate: '06/16/2023' }, now)).toBe(false);
    expect(isFitTestPastRetention({}, now)).toBe(false);
    expect(isFitTestPastRetention(null, now)).toBe(false);

    const fromTimestamp = getFitTestRetentionDate({
      createdAt: { toDate: () => new Date(2024, 1, 2, 18, 30) },
    });
    expect(fromTimestamp).toEqual(new Date(2024, 1, 2));
  });
});
