import { deleteDoc, getDoc, getDocs, setDoc, updateDoc, where } from 'firebase/firestore';
import {
  createManagedUserProfile,
  deleteManagedUser,
  getAllUsers,
  getPendingUsers,
  setUserRole,
  updateManagedUser,
} from './firebaseDb';

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

test('a regular admin cannot rename a tester', async () => {
  await expect(updateManagedUser('admin-1', 'tester-1', { name: 'Renamed' })).rejects.toThrow(
    /super admin/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('a super admin can rename a tester', async () => {
  await updateManagedUser('super-1', 'tester-1', { name: 'Renamed' });
  expect(updateDoc).toHaveBeenCalledTimes(1);
  expect(updateDoc.mock.calls[0][1]).toEqual(expect.objectContaining({ name: 'Renamed' }));
});

test('a super admin can set school tags, and a regular admin cannot', async () => {
  await updateManagedUser('admin-1', 'tester-1', {
    status: 'approved',
    school: 'Helene College of Nursing',
    schools: ['Helene College of Nursing'],
  });
  expect(updateDoc.mock.calls[0][1]).not.toHaveProperty('school');
  expect(updateDoc.mock.calls[0][1]).not.toHaveProperty('schools');

  updateDoc.mockClear();
  await updateManagedUser('super-1', 'tester-1', { school: 'Helene College of Nursing' });
  expect(updateDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
    school: 'Helene College of Nursing',
  }));

  updateDoc.mockClear();
  await updateManagedUser('super-1', 'super-1', {
    name: 'Sam',
    schools: ['Helene College of Nursing'],
  });
  expect(updateDoc.mock.calls[0][1]).not.toHaveProperty('schools');
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
  expect(setDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ role: 'admin' }),
    { merge: true }
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('setUserRole refuses a super admin demoting themselves', async () => {
  await expect(setUserRole('super-1', 'super-1', 'tester')).rejects.toThrow(
    /cannot remove your own super admin role/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
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

test('a super admin cannot create a superadmin profile', async () => {
  await expect(createManagedUserProfile('super-1', 'new-super', {
    email: 'second@example.com',
    role: 'superadmin',
    status: 'approved',
  })).rejects.toThrow(/cannot be created/i);
  expect(setDoc).not.toHaveBeenCalled();
});

test('a super admin can create an admin profile', async () => {
  await createManagedUserProfile('super-1', 'new-admin', {
    email: 'new-admin@example.com',
    role: 'admin',
    status: 'approved',
  });
  expect(setDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ role: 'admin', email: 'new-admin@example.com' })
  );
});

test('a regular admin cannot create an admin profile', async () => {
  await expect(createManagedUserProfile('admin-1', 'new-admin', {
    email: 'new-admin@example.com',
    role: 'admin',
    status: 'approved',
  })).rejects.toThrow(/super admin/i);
  expect(setDoc).not.toHaveBeenCalled();
});

test('setUserRole refuses to create a superadmin document', async () => {
  await expect(setUserRole('super-1', 'brand-new', 'superadmin')).rejects.toThrow(
    /cannot be created/i
  );
  expect(setDoc).not.toHaveBeenCalled();
  expect(updateDoc).not.toHaveBeenCalled();
});

test('setUserRole lets a super admin promote an existing user to superadmin', async () => {
  await setUserRole('super-1', 'admin-2', 'superadmin');
  expect(setDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ role: 'superadmin' }),
    { merge: true }
  );
  const payload = setDoc.mock.calls[0][1];
  expect(payload).not.toHaveProperty('status');
});

test('an admin cannot grant themselves superadmin', async () => {
  await expect(updateManagedUser('admin-1', 'admin-1', { role: 'superadmin' })).rejects.toThrow(
    /super admin/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('a regular admin cannot change an admin account status', async () => {
  await expect(updateManagedUser('admin-1', 'admin-2', { status: 'pending' })).rejects.toThrow(
    /super admin/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('a tester cannot approve a user', async () => {
  await expect(updateManagedUser('tester-1', 'tester-1', { status: 'approved' })).rejects.toThrow(
    /only admin/i
  );
  expect(updateDoc).not.toHaveBeenCalled();
});

test('pending approvals hide admin accounts from a regular admin', async () => {
  users['admin-1'] = { ...users['admin-1'], schools: ['Helene College of Nursing'] };
  users['admin-2'] = { ...users['admin-2'], status: 'pending' };
  getDocs.mockResolvedValueOnce({
    forEach(callback) {
      callback({
        id: 'admin-2',
        data: () => users['admin-2'],
      });
      callback({
        id: 'tester-1',
        data: () => users['tester-1'],
      });
    },
  });

  await expect(getPendingUsers('admin-1')).resolves.toEqual([
    expect.objectContaining({ id: 'tester-1', role: 'tester' }),
  ]);

  getDocs.mockResolvedValueOnce({
    forEach(callback) {
      callback({
        id: 'admin-2',
        data: () => users['admin-2'],
      });
      callback({
        id: 'tester-1',
        data: () => users['tester-1'],
      });
    },
  });

  const forSuperAdmin = await getPendingUsers('super-1');
  expect(forSuperAdmin.map((item) => item.id).sort()).toEqual(['admin-2', 'tester-1']);
});

test('scoped admin lists query testers in their own schools', async () => {
  const schools = ['Helene College of Nursing', 'Example Second School'];
  users['admin-1'] = { ...users['admin-1'], schools };
  getDocs.mockResolvedValue({ forEach() {} });

  await getAllUsers('admin-1');
  expect(where).toHaveBeenCalledWith('role', '==', 'tester');
  expect(where).toHaveBeenCalledWith('school', 'in', schools);

  where.mockClear();
  await getPendingUsers('admin-1');
  expect(where).toHaveBeenCalledWith('status', '==', 'pending');
  expect(where).toHaveBeenCalledWith('role', '==', 'tester');
  expect(where).toHaveBeenCalledWith('school', 'in', schools);

  where.mockClear();
  getDocs.mockClear();
  await getAllUsers('super-1');
  expect(where).not.toHaveBeenCalled();
  expect(getDocs).toHaveBeenCalled();

  getDocs.mockClear();
  users['admin-1'] = { ...users['admin-1'], schools: [] };
  await expect(getAllUsers('admin-1')).resolves.toEqual([]);
  expect(getDocs).not.toHaveBeenCalled();

  const manySchools = Array.from({ length: 31 }, (_, index) => `School ${index}`);
  users['admin-1'] = { ...users['admin-1'], schools: manySchools };
  getDocs.mockResolvedValue({ forEach() {} });
  await getAllUsers('admin-1');
  const inCalls = where.mock.calls.filter((call) => call[0] === 'school' && call[1] === 'in');
  expect(inCalls.map((call) => call[2].length)).toEqual([30, 1]);
});
