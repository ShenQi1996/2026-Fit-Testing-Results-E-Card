import {
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { getDoc, setDoc, updateDoc } from 'firebase/firestore';
import * as authApi from './firebaseAuth';
import { getAuthErrorMessage, signIn } from './firebaseAuth';

const SIGN_IN_EXPORTS = ['signIn', 'signInWithGoogle', 'handleGoogleRedirect'];

const isSignInExport = (name) =>
  name === 'handleGoogleRedirect' || name.startsWith('signIn');

const PENDING_MESSAGE = 'Your account is pending admin approval. Please contact an administrator.';

const authUser = {
  uid: 'uid-1',
  email: 'tester@example.com',
  displayName: 'Test Tester',
  metadata: { creationTime: '2026-01-01T00:00:00.000Z' },
};

test('auth/operation-not-allowed uses the email and password message', () => {
  expect(getAuthErrorMessage('auth/operation-not-allowed')).toBe(
    'Email/password accounts are not enabled. Please contact support.'
  );
});

describe('signIn user profile', () => {
  beforeEach(() => {
    signInWithEmailAndPassword.mockReset();
    signOut.mockReset();
    getDoc.mockReset();
    setDoc.mockReset();
    updateDoc.mockReset();
    signInWithEmailAndPassword.mockResolvedValue({ user: authUser });
    signOut.mockResolvedValue();
    setDoc.mockResolvedValue();
    updateDoc.mockResolvedValue();
  });

  test('signIn with no profile creates a pending tester doc and throws the pending message', async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined });

    await expect(signIn('tester@example.com', 'secret')).rejects.toThrow(PENDING_MESSAGE);

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ args: [expect.anything(), 'users', 'uid-1'] }),
      expect.objectContaining({
        email: 'tester@example.com',
        name: 'Test Tester',
        role: 'tester',
        status: 'pending',
        provider: 'password',
      })
    );
    expect(signOut).toHaveBeenCalled();
  });

  test('signIn with an approved profile does not change status', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        email: 'old@example.com',
        name: 'Existing Name',
        role: 'admin',
        status: 'approved',
      }),
    });

    await expect(signIn('tester@example.com', 'secret')).resolves.toMatchObject({
      uid: 'uid-1',
      email: 'tester@example.com',
      role: 'admin',
      status: 'approved',
    });

    expect(setDoc).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const updatePayload = updateDoc.mock.calls[0][1];
    expect(updatePayload).toEqual(expect.objectContaining({
      email: 'tester@example.com',
      name: 'Test Tester',
    }));
    expect(updatePayload).not.toHaveProperty('status');
    expect(updatePayload).not.toHaveProperty('role');
  });
});

describe('sign-in profile coverage', () => {
  test('the sign-in export list matches the module', () => {
    expect(Object.keys(authApi).filter(isSignInExport).sort())
      .toEqual([...SIGN_IN_EXPORTS].sort());
  });

  test.each(SIGN_IN_EXPORTS)(
    '%s ensures a profile for its Firebase user before it finishes',
    async (name) => {
      const uid = `uid-${name}`;
      const user = {
        uid,
        email: `${name}@example.com`,
        displayName: 'Pat Tester',
        metadata: { creationTime: '2026-01-01T00:00:00.000Z' },
        providerData: [{ providerId: 'google.com' }],
      };

      signInWithEmailAndPassword.mockReset();
      signInWithPopup.mockReset();
      getRedirectResult.mockReset();
      signOut.mockReset();
      getDoc.mockReset();
      setDoc.mockReset();
      updateDoc.mockReset();
      signInWithEmailAndPassword.mockResolvedValue({ user });
      signInWithPopup.mockResolvedValue({ user });
      getRedirectResult.mockResolvedValue({ user });
      signOut.mockResolvedValue();
      getDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
      setDoc.mockResolvedValue();
      updateDoc.mockResolvedValue();

      const args = name === 'signIn' ? [user.email, 'secret'] : [];
      await expect(authApi[name](...args)).rejects.toThrow(PENDING_MESSAGE);

      const wroteProfile = [...setDoc.mock.calls, ...updateDoc.mock.calls].some(
        (call) => call[0]?.args?.[2] === uid
      );
      expect(wroteProfile).toBe(true);
    }
  );
});
