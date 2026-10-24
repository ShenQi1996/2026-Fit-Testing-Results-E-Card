import { signOut } from 'firebase/auth';
import { getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { finalizeSignIn } from './firebaseAuth';
import {
  createManagedUserProfile,
  getUserAccessProfile,
  setUserRole,
  updateManagedUser,
} from './firebaseDb';

const PENDING_MESSAGE = 'Your account is pending admin approval. Please contact an administrator.';

const userDoc = (data, exists = true) => ({
  exists: () => exists,
  data: () => data,
  id: 'uid-1',
});

const adminDoc = () => userDoc({ role: 'admin', status: 'approved' });

describe('user status access', () => {
  beforeEach(() => {
    getDoc.mockReset();
    setDoc.mockReset();
    updateDoc.mockReset();
    signOut.mockReset();
    setDoc.mockResolvedValue();
    updateDoc.mockResolvedValue();
    signOut.mockResolvedValue();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('a profile with no status is pending and cannot sign in', async () => {
    getDoc.mockResolvedValue(userDoc({ role: 'admin', email: 'qisam1989@gmail.com' }));

    await expect(getUserAccessProfile('uid-1')).resolves.toEqual({
      role: 'admin',
      status: 'pending',
      school: '',
      schools: [],
      startDate: null,
      endDate: null,
    });

    await expect(finalizeSignIn({
      uid: 'uid-1',
      email: 'qisam1989@gmail.com',
      displayName: 'Sam',
      metadata: {},
    }, 'password')).rejects.toThrow(PENDING_MESSAGE);
    expect(signOut).toHaveBeenCalled();
  });

  test('an unknown status is pending and cannot sign in', async () => {
    getDoc.mockResolvedValue(userDoc({ role: 'tester', status: 'active' }));

    await expect(getUserAccessProfile('uid-1')).resolves.toEqual({
      role: 'tester',
      status: 'pending',
      school: '',
      schools: [],
      startDate: null,
      endDate: null,
    });

    await expect(finalizeSignIn({
      uid: 'uid-2',
      email: 'person@example.com',
      displayName: 'Pat',
      metadata: {},
    }, 'password')).rejects.toThrow(PENDING_MESSAGE);
    expect(signOut).toHaveBeenCalled();
  });

  test('setUserRole on a new uid writes status pending', async () => {
    getDoc.mockImplementation(async (ref) => {
      const id = ref?.args?.[2];
      if (id === 'super-1') return userDoc({ role: 'superadmin', status: 'approved' });
      return userDoc(undefined, false);
    });

    await setUserRole('super-1', 'new-uid', 'tester');

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ args: [expect.anything(), 'users', 'new-uid'] }),
      expect.objectContaining({
        role: 'tester',
        status: 'pending',
      })
    );
    const payload = setDoc.mock.calls[0][1];
    expect(payload).toHaveProperty('status', 'pending');
  });

  test('setUserRole merges an existing doc and fills a missing status', async () => {
    getDoc.mockImplementation(async (ref) => {
      const id = ref?.args?.[2];
      if (id === 'super-1') return userDoc({ role: 'superadmin', status: 'approved' });
      return userDoc({ role: 'tester', email: 'a@example.com' });
    });

    await setUserRole('super-1', 'uid-1', 'admin');

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ args: [expect.anything(), 'users', 'uid-1'] }),
      expect.objectContaining({ role: 'admin', status: 'pending' }),
      { merge: true }
    );
  });

  test('setUserRole does not overwrite an explicit status', async () => {
    getDoc.mockImplementation(async (ref) => {
      const id = ref?.args?.[2];
      if (id === 'super-1') return userDoc({ role: 'superadmin', status: 'approved' });
      return userDoc({ role: 'tester', status: 'approved' });
    });

    await setUserRole('super-1', 'uid-1', 'admin');

    const payload = setDoc.mock.calls[0][1];
    expect(payload).toEqual(expect.objectContaining({ role: 'admin' }));
    expect(payload).not.toHaveProperty('status');
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
  });

  test('creating a managed profile without status stores pending', async () => {
    getDoc
      .mockResolvedValueOnce(userDoc({
        role: 'admin',
        status: 'approved',
        schools: ['Helene College of Nursing'],
      }))
      .mockResolvedValueOnce(userDoc({
        role: 'admin',
        status: 'approved',
        schools: ['Helene College of Nursing'],
      }))
      .mockResolvedValueOnce(userDoc({
        email: 'new@example.com',
        role: 'tester',
        status: 'pending',
        school: 'Helene College of Nursing',
      }));

    await createManagedUserProfile('admin-1', 'new-uid', { email: 'new@example.com' });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'pending',
        role: 'tester',
        school: 'Helene College of Nursing',
      })
    );
  });

  test('updating a profile with no status does not write approved', async () => {
    getDoc
      .mockResolvedValueOnce(adminDoc())
      .mockResolvedValueOnce(userDoc({ role: 'tester', email: 'a@example.com', name: 'A' }))
      .mockResolvedValueOnce(userDoc({
        role: 'tester',
        email: 'a@example.com',
        name: 'A',
        status: 'pending',
      }));

    await updateManagedUser('admin-1', 'user-2', { name: 'A' });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'pending' })
    );
    expect(updateDoc.mock.calls[0][1].status).not.toBe('approved');
  });
});
