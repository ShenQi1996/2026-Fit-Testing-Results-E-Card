import {
  canModifyManagedUser,
  isStaffAdminRole,
  isSuperAdminRole,
  rolesAssignableBy,
} from './roles';

describe('role helpers', () => {
  test('staff admin includes admin and superadmin only', () => {
    expect(isStaffAdminRole('admin')).toBe(true);
    expect(isStaffAdminRole('superadmin')).toBe(true);
    expect(isStaffAdminRole('tester')).toBe(false);
    expect(isSuperAdminRole('superadmin')).toBe(true);
    expect(isSuperAdminRole('admin')).toBe(false);
  });

  test('only a super admin is offered admin and superadmin', () => {
    expect(rolesAssignableBy('superadmin')).toEqual(['tester', 'admin', 'superadmin']);
    expect(rolesAssignableBy('admin')).toEqual(['tester']);
    expect(rolesAssignableBy('tester')).toEqual(['tester']);
  });

  test('a regular admin cannot modify admin or superadmin profiles', () => {
    expect(canModifyManagedUser('admin', 'tester')).toBe(true);
    expect(canModifyManagedUser('admin', 'admin')).toBe(false);
    expect(canModifyManagedUser('admin', 'superadmin')).toBe(false);
    expect(canModifyManagedUser('superadmin', 'admin')).toBe(true);
    expect(canModifyManagedUser('superadmin', 'superadmin')).toBe(true);
    expect(canModifyManagedUser('tester', 'tester')).toBe(false);
  });
});
