import {
  canModifyManagedUser,
  isAdminOrAbove,
  isSuperAdmin,
  rolesAssignableBy,
  rolesCreatableBy,
} from './roles';

describe('role helpers', () => {
  test('isAdminOrAbove includes admin and superadmin', () => {
    expect(isAdminOrAbove('admin')).toBe(true);
    expect(isAdminOrAbove('superadmin')).toBe(true);
    expect(isAdminOrAbove('tester')).toBe(false);
    expect(isAdminOrAbove(undefined)).toBe(false);
    expect(isSuperAdmin('superadmin')).toBe(true);
    expect(isSuperAdmin('admin')).toBe(false);
  });

  test('only a super admin is offered admin and superadmin on an existing user', () => {
    expect(rolesAssignableBy('superadmin')).toEqual(['tester', 'admin', 'superadmin']);
    expect(rolesAssignableBy('admin')).toEqual(['tester']);
    expect(rolesAssignableBy('tester')).toEqual(['tester']);
  });

  test('nobody can create a superadmin from the client role list', () => {
    expect(rolesCreatableBy('superadmin')).toEqual(['tester', 'admin']);
    expect(rolesCreatableBy('admin')).toEqual(['tester']);
    expect(rolesCreatableBy('tester')).toEqual(['tester']);
    expect(rolesCreatableBy('superadmin')).not.toContain('superadmin');
  });

  test('a regular admin cannot modify admin or superadmin profiles', () => {
    expect(canModifyManagedUser('admin', 'tester')).toBe(true);
    expect(canModifyManagedUser('admin', undefined)).toBe(true);
    expect(canModifyManagedUser('admin', 'admin')).toBe(false);
    expect(canModifyManagedUser('admin', 'superadmin')).toBe(false);
    expect(canModifyManagedUser('superadmin', 'admin')).toBe(true);
    expect(canModifyManagedUser('superadmin', 'superadmin')).toBe(true);
    expect(canModifyManagedUser('tester', 'tester')).toBe(false);
  });
});
