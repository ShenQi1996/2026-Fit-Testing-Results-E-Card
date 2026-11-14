import { RESPIRATOR_STYLE_OPTIONS, isRespiratorStyle } from './fitTestOptions';

test('the respirator style dropdown offers exactly Cup (molded), Flat-fold, and Duckbill', () => {
  expect(RESPIRATOR_STYLE_OPTIONS.map((option) => option.value)).toEqual([
    'Cup (molded)',
    'Flat-fold',
    'Duckbill',
  ]);
  expect(RESPIRATOR_STYLE_OPTIONS.map((option) => option.label)).toEqual([
    'Cup (molded)',
    'Flat-fold',
    'Duckbill',
  ]);
});

test('only the three styles count as a chosen style', () => {
  expect(isRespiratorStyle('Cup (molded)')).toBe(true);
  expect(isRespiratorStyle('Flat-fold')).toBe(true);
  expect(isRespiratorStyle('Duckbill')).toBe(true);
  expect(isRespiratorStyle('')).toBe(false);
  expect(isRespiratorStyle(undefined)).toBe(false);
  expect(isRespiratorStyle('Filtering facepiece')).toBe(false);
  expect(isRespiratorStyle('duckbill')).toBe(false);
});
