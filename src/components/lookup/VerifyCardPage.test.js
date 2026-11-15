import { verifyDetailRows } from './VerifyCardPage';

jest.mock('../../services/firebaseDb', () => ({
  lookupFitTestForVerification: jest.fn(),
}));

jest.mock('./VerifyAnimation', () => () => null);
jest.mock('../common/LoadingAnimation', () => () => null);

const card = {
  clientName: 'Ada',
  issueDate: '01/15/2026',
  expirationDate: '01/15/2027',
  result: 'Pass',
  fitTestMethod: 'Quantitative',
  fitFactor: 180,
};

test('the public verify page lists a legacy Quantitative fit factor after the method', () => {
  const rows = verifyDetailRows(card);
  const keys = rows.map((row) => row.key);
  expect(keys.indexOf('fitFactor')).toBe(keys.indexOf('fitTestMethod') + 1);
  expect(rows.find((row) => row.key === 'fitFactor')).toEqual({
    key: 'fitFactor',
    label: 'Fit factor',
    value: '180',
  });
});

test('the public verify page has no fit factor row for qualitative cards', () => {
  expect(verifyDetailRows({ ...card, fitTestMethod: 'Qualitative' }).map((row) => row.key))
    .not.toContain('fitFactor');
  expect(verifyDetailRows({ ...card, fitFactor: undefined }).map((row) => row.key))
    .not.toContain('fitFactor');
  expect(verifyDetailRows({ ...card, fitTestMethod: '' }).find((row) => row.key === 'fitTestMethod').value)
    .toBe('Qualitative');
});

test('the public verify page still hides program administrator fields', () => {
  const rows = verifyDetailRows({
    ...card,
    programAdministratorName: 'Ada Admin',
    programAdministratorContact: 'ada-admin@example.com',
  });
  expect(rows.map((row) => row.value)).not.toContain('Ada Admin');
  expect(rows.map((row) => row.value)).not.toContain('ada-admin@example.com');
});

test('the public verify page shows the style, or a dash for a legacy card', () => {
  const styled = verifyDetailRows({ ...card, style: 'Duckbill' }).find((row) => row.key === 'style');
  expect(styled).toEqual({ key: 'style', label: 'Style', value: 'Duckbill' });
  const legacyRow = verifyDetailRows({ ...card, style: undefined }).find((row) => row.key === 'style');
  expect(legacyRow.value).toBe('—');
});
