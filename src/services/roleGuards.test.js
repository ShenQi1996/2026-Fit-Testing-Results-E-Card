import { deleteDoc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  deleteManagedUser,
  setUserRole,
  updateManagedUser,
} from './firebaseDb';
import { setAdminUser, setCurrentUserAsAdminIfEmail } from '../utils/adminUtils';
import { setAdmins } from '../utils/setAdmins';

const users = {};

const resetUsers = (next) => {
  Object.keys(users).forEach((key) => delete users[key]);
  Object.assign(users, next);
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  resetUsers({
    'admin-1': { role: 'admin', status: 'approved', email: 'admin@example.com', name: 'Admin' },
    'super-1': { role: 'superadmin', status: 'approved', email: 'sam@example.com', name: 'Sam' },
    'tester-1': { role: 'tester', status: 'pending', email: 'tester@example.com', name: 'Tester' },
    'admin-2': { role: 'admin', status: 'approved', email: 'other@example.com', name: 'Other Admin' },
  });
  getDoc.mockImplementation(async (ref) => {
    const id = ref?.args?.[2];
    if (!Object.prototype.hasOwnProperty.call(users, id)) {
      return { exists: () => false, data: () => undefined, id };
    }
    return { exists: () => true, data: () => users[id], id };
  });
  updateDoc.mockClear();
  setDoc.mockClear();
  deleteDoc.mockClear();
  updateDoc.mockResolvedValue(undefined);
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
});

afterEach(() => {
  console.error.mockRestore();
});

test('a regular admin cannot promote a tester to admin', async () => {
  await expect(updateManagedUser('admin-1', 'tester-1', { role: 'admin' })).rejects.toThrow(
    /super admin/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('a regular admin cannot edit an admin profile', async () => {
  await expect(updateManagedUser('admin-1', 'admin-2', { name: 'Renamed' })).rejects.toThrow(
    /super admin/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('a regular admin cannot edit a super admin profile', async () => {
  await expect(updateManagedUser('admin-1', 'super-1', { name: 'Renamed' })).rejects.toThrow(
    /super admin/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('a regular admin can approve a tester', async () => {
  await updateManagedUser('admin-1', 'tester-1', { status: 'approved' });
  expect(updateDoc).toHaveBeenCalledTimes(1);
  expect(updateDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
    role: 'tester',
    status: 'approved',
  }));
});

test('a super admin can grant admin', async () => {
  await updateManagedUser('super-1', 'tester-1', { role: 'admin' });
  expect(updateDoc).toHaveBeenCalledTimes(1);
  expect(updateDoc.mock.calls[0][1]).toEqual(expect.objectContaining({ role: 'admin' }));
});

test('a super admin cannot demote themselves', async () => {
  await expect(updateManagedUser('super-1', 'super-1', { role: 'admin' })).rejects.toThrow(
    /cannot remove your own super admin role/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('setUserRole refuses an admin grant from a regular admin', async () => {
  await expect(setUserRole('admin-1', 'tester-1', 'admin')).rejects.toThrow(/super admin/i);
  expect(updateDoc).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
});

test('setUserRole lets a super admin grant admin', async () => {
  await setUserRole('super-1', 'tester-1', 'admin');
  expect(updateDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ role: 'admin' })
  );
});

test('setUserRole refuses a super admin demoting themselves', async () => {
  await expect(setUserRole('super-1', 'super-1', 'tester')).rejects.toThrow(
    /cannot remove your own super admin role/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('a regular admin cannot delete an admin profile', async () => {
  await expect(deleteManagedUser('admin-1', 'admin-2')).rejects.toThrow(/super admin/i);
  expect(deleteDoc).not.toHaveBeenCalled();
});

test('a regular admin can delete a tester profile', async () => {
  await deleteManagedUser('admin-1', 'tester-1');
  expect(deleteDoc).toHaveBeenCalledTimes(1);
});

test('a super admin cannot delete themselves', async () => {
  await expect(deleteManagedUser('super-1', 'super-1')).rejects.toThrow(/cannot delete your own account/i);
  expect(deleteDoc).not.toHaveBeenCalled();
});

test('disabled client grant helpers do not write a role', async () => {
  await expect(setCurrentUserAsAdminIfEmail('qisam1989@gmail.com')).rejects.toThrow(/disabled/i);
  await expect(setAdminUser('someone')).rejects.toThrow(/disabled/i);
  await expect(setAdmins()).rejects.toThrow(/disabled/i);
  expect(setDoc).not.toHaveBeenCalled();
  expect(updateDoc).not.toHaveBeenCalled();
});
