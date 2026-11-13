import {
  legacyFitFactorDisplay,
  toLookupCardData,
  toVerifyCardData,
} from './cardCopies';

const legacy = {
  clientName: 'Ada',
  fitTestMethod: 'Quantitative',
  fitFactor: 180,
  result: 'Pass',
};

test('card copies carry a legacy Quantitative fit factor exactly as stored', () => {
  expect(toVerifyCardData(legacy).fitFactor).toBe(180);
  expect(toLookupCardData(legacy).fitFactor).toBe(180);
  expect(toVerifyCardData({ ...legacy, fitFactor: '200' }).fitFactor).toBe('200');
  expect(toVerifyCardData({ ...legacy, fitFactor: 0 }).fitFactor).toBe(0);
});

test('card copies leave fitFactor off when the record has none', () => {
  const qualitative = { clientName: 'Ada', fitTestMethod: 'Qualitative', result: 'Pass' };
  expect(toVerifyCardData(qualitative)).not.toHaveProperty('fitFactor');
  expect(toLookupCardData(qualitative)).not.toHaveProperty('fitFactor');
  expect(toVerifyCardData({ ...qualitative, fitFactor: null })).not.toHaveProperty('fitFactor');
  expect(toLookupCardData({ ...qualitative, fitFactor: undefined })).not.toHaveProperty('fitFactor');
});

test('only legacy Quantitative records display a fit factor', () => {
  expect(legacyFitFactorDisplay(legacy)).toBe('180');
  expect(legacyFitFactorDisplay({ ...legacy, fitFactor: ' 250 ' })).toBe('250');
  expect(legacyFitFactorDisplay({ ...legacy, fitTestMethod: 'Qualitative' })).toBe('');
  expect(legacyFitFactorDisplay({ ...legacy, fitTestMethod: 'Locked to Qualitative' })).toBe('');
  expect(legacyFitFactorDisplay({ ...legacy, fitTestMethod: '' })).toBe('');
  expect(legacyFitFactorDisplay({ fitTestMethod: 'Quantitative' })).toBe('');
  expect(legacyFitFactorDisplay({ fitTestMethod: 'Quantitative', fitFactor: '' })).toBe('');
  expect(legacyFitFactorDisplay(null)).toBe('');
});

test('card copies carry the respirator style and tolerate a legacy record without one', () => {
  expect(toVerifyCardData({ ...legacy, style: 'Cup (molded)' }).style).toBe('Cup (molded)');
  expect(toLookupCardData({ ...legacy, style: 'Cup (molded)' }).style).toBe('Cup (molded)');
  expect(() => toVerifyCardData(legacy)).not.toThrow();
  expect(() => toLookupCardData(legacy)).not.toThrow();
});
