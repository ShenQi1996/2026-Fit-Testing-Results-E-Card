import { getAuthErrorMessage } from './firebaseAuth';

test('auth/operation-not-allowed uses the email and password message', () => {
  expect(getAuthErrorMessage('auth/operation-not-allowed')).toBe(
    'Email/password accounts are not enabled. Please contact support.'
  );
});
