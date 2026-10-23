import {
  buildLookupKey,
  normalizeClientName,
  normalizeDob,
  normalizeEmail,
} from './lookupKey';

describe('lookup key helpers', () => {
  test('normalizes name, date of birth, and email for matching', () => {
    expect(normalizeClientName('  Jane   Smith ')).toBe('jane smith');
    expect(normalizeDob('01/02/1990')).toBe('01/02/1990');
    expect(normalizeDob('1/2/1990')).toBe('');
    expect(normalizeDob('not-a-date')).toBe('');
    expect(normalizeEmail('  Person@Example.com ')).toBe('person@example.com');
  });

  test('buildLookupKey is a stable sha-256 and is empty when a value is missing', async () => {
    const key = await buildLookupKey('Jane Smith', '01/02/1990', 'A@Example.com');
    expect(key).toBe('ab5de9b015a65cadd212f9f5746c652ea96e77f0925ef57d46d8e9126be6c348');
    await expect(buildLookupKey('Jane Smith', '01/02/1990', 'A@Example.com')).resolves.toBe(key);
    await expect(buildLookupKey('', '01/02/1990', 'a@example.com')).resolves.toBe('');
    await expect(buildLookupKey('Jane', '1/2/1990', 'a@example.com')).resolves.toBe('');
  });
});
