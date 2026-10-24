import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../config/firebase';
import * as authApi from './firebaseAuth';
import { getAuthErrorMessage, signIn, signUp } from './firebaseAuth';

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
      schools: [],
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

const approvedProfile = {
  exists: () => true,
  data: () => ({
    email: 'old@example.com',
    name: 'Existing Name',
    role: 'tester',
    status: 'approved',
  }),
};

describe('sign-in failure and legacy profiles', () => {
  beforeEach(() => {
    signInWithEmailAndPassword.mockReset();
    createUserWithEmailAndPassword.mockReset();
    signInWithPopup.mockReset();
    getRedirectResult.mockReset();
    onAuthStateChanged.mockReset();
    signOut.mockReset();
    getDoc.mockReset();
    setDoc.mockReset();
    updateDoc.mockReset();
    signOut.mockResolvedValue();
    setDoc.mockResolvedValue();
    updateDoc.mockResolvedValue();
    signInWithEmailAndPassword.mockResolvedValue({ user: authUser });
    auth.currentUser = null;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
    auth.currentUser = null;
  });

  test('an approved user still signs in when the profile backfill is denied', async () => {
    getDoc.mockResolvedValue(approvedProfile);
    updateDoc.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));

    await expect(signIn('tester@example.com', 'secret')).resolves.toMatchObject({
      uid: 'uid-1',
      status: 'approved',
      role: 'tester',
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  test('a legacy profile with no status is pending and the session is cleared', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        email: 'qisam1989@gmail.com',
        name: 'Sam',
        role: 'admin',
      }),
    });

    await expect(signIn('qisam1989@gmail.com', 'secret')).rejects.toThrow(PENDING_MESSAGE);
    expect(signOut).toHaveBeenCalled();
  });

  test('signUp creates a pending profile and signs out', async () => {
    createUserWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: 'new-1',
        email: 'new@example.com',
        displayName: '',
        metadata: { creationTime: '2026-01-01T00:00:00.000Z' },
      },
    });
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined });

    await expect(signUp('new@example.com', 'secret', 'New Tester')).rejects.toThrow(PENDING_MESSAGE);
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ args: [expect.anything(), 'users', 'new-1'] }),
      expect.objectContaining({ status: 'pending', role: 'tester' })
    );
    expect(signOut).toHaveBeenCalled();
  });

  test('getCurrentUser returns the approved profile', async () => {
    auth.currentUser = authUser;
    getDoc.mockResolvedValue(approvedProfile);

    await expect(authApi.getCurrentUser()).resolves.toMatchObject({
      uid: 'uid-1',
      status: 'approved',
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  test('getCurrentUser signs out and returns null when restore fails', async () => {
    auth.currentUser = authUser;
    getDoc.mockRejectedValue(new Error('firestore down'));

    await expect(authApi.getCurrentUser()).resolves.toBeNull();
    expect(signOut).toHaveBeenCalled();
  });

  test('onAuthStateChange signs out and reports logged out when restore fails', async () => {
    getDoc.mockRejectedValue(new Error('firestore down'));
    let listener;
    onAuthStateChanged.mockImplementation((_auth, callback) => {
      listener = callback;
      return jest.fn();
    });
    const seen = [];
    authApi.onAuthStateChange((user) => seen.push(user));

    await listener(authUser);

    expect(seen).toEqual([null]);
    expect(signOut).toHaveBeenCalled();
  });

  test('onAuthStateChange restores an approved user', async () => {
    getDoc.mockResolvedValue(approvedProfile);
    let listener;
    onAuthStateChanged.mockImplementation((_auth, callback) => {
      listener = callback;
      return jest.fn();
    });
    const seen = [];
    authApi.onAuthStateChange((user) => seen.push(user));

    await listener(authUser);

    expect(seen).toEqual([
      expect.objectContaining({ uid: 'uid-1', status: 'approved' }),
    ]);
    expect(signOut).not.toHaveBeenCalled();
  });

  test('Google redirect and the auth listener finalize the same user once', async () => {
    const user = {
      ...authUser,
      providerData: [{ providerId: 'google.com' }],
    };
    getDoc.mockResolvedValue(approvedProfile);
    getRedirectResult.mockResolvedValue({ user });
    let listener;
    onAuthStateChanged.mockImplementation((_auth, callback) => {
      listener = callback;
      return jest.fn();
    });

    authApi.onAuthStateChange(() => {});
    const redirectPromise = authApi.handleGoogleRedirect();
    const restorePromise = listener(user);
    await Promise.all([redirectPromise, restorePromise]);

    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });
});
