import * as firebaseAuth from 'firebase/auth';
import { deleteDoc, getDoc } from 'firebase/firestore';
import { deleteManagedUser } from './firebaseDb';

describe('deleteManagedUser', () => {
  beforeEach(() => {
    getDoc.mockReset();
    deleteDoc.mockReset();
    firebaseAuth.deleteUser.mockClear();
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'admin', status: 'approved' }),
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('deletes only the users profile document and does not delete the Auth login', async () => {
    await deleteManagedUser('admin-1', 'user-2');

    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ args: [expect.anything(), 'users', 'user-2'] })
    );
    expect(firebaseAuth.deleteUser).not.toHaveBeenCalled();
    expect(firebaseAuth.signOut).not.toHaveBeenCalled();
  });
});
