import {
  accessDateInputValue,
  accessWindowOrderError,
  accountStatusLabel,
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

  test('client role choices are tester or admin, never superadmin', () => {
    expect(rolesAssignableBy('superadmin')).toEqual(['tester', 'admin']);
    expect(rolesAssignableBy('admin')).toEqual(['tester']);
    expect(rolesAssignableBy('tester')).toEqual(['tester']);
    expect(rolesAssignableBy('superadmin')).not.toContain('superadmin');
    expect(rolesAssignableBy('admin')).not.toContain('superadmin');
  });

  test('nobody can create a superadmin from the client role list', () => {
    expect(rolesCreatableBy('superadmin')).toEqual(['tester', 'admin']);
    expect(rolesCreatableBy('admin')).toEqual(['tester']);
    expect(rolesCreatableBy('tester')).toEqual(['tester']);
    expect(rolesCreatableBy('superadmin')).not.toContain('superadmin');
  });

  test('an admin outside the access window is not an admin, and a super admin is', () => {
    const now = new Date('2026-10-23T15:00:00');
    expect(isAdminOrAbove({ role: 'admin' }, now)).toBe(true);
    expect(isAdminOrAbove({
      role: 'admin',
      startDate: '2026-10-01T00:00:00',
      endDate: '2026-10-31T23:59:59',
    }, now)).toBe(true);
    expect(isAdminOrAbove({ role: 'admin', endDate: '2026-10-01T00:00:00' }, now)).toBe(false);
    expect(isAdminOrAbove({ role: 'admin', startDate: '2026-11-01T00:00:00' }, now)).toBe(false);
    expect(isAdminOrAbove({
      role: 'superadmin',
      startDate: '2026-11-01T00:00:00',
      endDate: '2026-10-01T00:00:00',
    }, now)).toBe(true);
    expect(accessDateInputValue('2026-06-01T12:00:00')).toMatch(/^2026-06-0[12]$/);
    expect(accessWindowOrderError('2026-10-10', '2026-10-01'))
      .toBe('Access end date cannot be before the start date.');
    expect(accessWindowOrderError('2026-10-10', '2026-10-10')).toBe('');
    expect(accessWindowOrderError('', '2026-10-10')).toBe('');
  });

  test('the status pill reads Expired only for an approved account whose end day is before today', () => {
    const now = new Date(2026, 9, 23, 15, 0, 0);
    expect(accountStatusLabel({
      status: 'approved',
      endDate: '2026-10-13T23:59:59',
    }, now)).toEqual({ label: 'Expired', statusClass: 'status-expired' });
    expect(accountStatusLabel({
      status: 'approved',
      startDate: '2026-10-01T00:00:00',
      endDate: '2026-10-23T23:59:59',
    }, now)).toEqual({ label: 'Approved', statusClass: 'status-approved' });
    expect(accountStatusLabel({ status: 'approved' }, now)).toEqual({
      label: 'Approved',
      statusClass: 'status-approved',
    });
    expect(accountStatusLabel({
      status: 'pending',
      endDate: '2020-01-01T00:00:00',
    }, now)).toEqual({ label: 'Pending', statusClass: 'status-pending' });
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
