import {
  accessDateInputValue,
  accessWindowOrderError,
  accessEndLocksAccount,
  accountStatusLabel,
  canModifyManagedUser,
  isAdminOrAbove,
  isFaculty,
  isSuperAdmin,
  rolesAssignableBy,
  rolesCreatableBy,
} from './roles';

describe('role helpers', () => {
  test('isAdminOrAbove includes admin and superadmin', () => {
    expect(isAdminOrAbove('admin')).toBe(true);
    expect(isAdminOrAbove('superadmin')).toBe(true);
    expect(isAdminOrAbove('tester')).toBe(false);
    expect(isAdminOrAbove('faculty')).toBe(false);
    expect(isFaculty('faculty')).toBe(true);
    expect(isFaculty('tester')).toBe(false);
    expect(isAdminOrAbove(undefined)).toBe(false);
    expect(isSuperAdmin('superadmin')).toBe(true);
    expect(isSuperAdmin('admin')).toBe(false);
  });

  test('client role choices include faculty for admins, never superadmin', () => {
    expect(rolesAssignableBy('superadmin')).toEqual(['tester', 'faculty', 'admin']);
    expect(rolesAssignableBy('admin')).toEqual(['tester', 'faculty']);
    expect(rolesAssignableBy('tester')).toEqual(['tester']);
    expect(rolesAssignableBy('faculty')).toEqual(['tester']);
    expect(rolesAssignableBy('superadmin')).not.toContain('superadmin');
    expect(rolesAssignableBy('admin')).not.toContain('superadmin');
  });

  test('nobody can create a superadmin from the client role list', () => {
    expect(rolesCreatableBy('superadmin')).toEqual(['tester', 'faculty', 'admin']);
    expect(rolesCreatableBy('admin')).toEqual(['tester', 'faculty']);
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

  test('the status pill matches the rules end instant, including the equal boundary', () => {
    const end = new Date('2026-10-23T15:00:00.000Z');
    const approved = { role: 'admin', status: 'approved', endDate: end.toISOString() };
    expect(accessEndLocksAccount(end.toISOString(), end)).toBe(false);
    expect(accessEndLocksAccount(end.toISOString(), new Date(end.getTime() + 1))).toBe(true);
    expect(accountStatusLabel(approved, end)).toEqual({
      label: 'Approved',
      statusClass: 'status-approved',
    });
    expect(accountStatusLabel(approved, new Date(end.getTime() - 1))).toEqual({
      label: 'Approved',
      statusClass: 'status-approved',
    });
    expect(accountStatusLabel(approved, new Date(end.getTime() + 1))).toEqual({
      label: 'Expired',
      statusClass: 'status-expired',
    });
    expect(accountStatusLabel({
      role: 'admin',
      status: 'approved',
      endDate: '2026-10-23T12:00:00.000Z',
    }, new Date('2026-10-23T18:00:00.000Z')).label).toBe('Expired');
    expect(accountStatusLabel({ role: 'admin', status: 'approved' }, end)).toEqual({
      label: 'Approved',
      statusClass: 'status-approved',
    });
    expect(accountStatusLabel({
      role: 'admin',
      status: 'pending',
      endDate: '2020-01-01T00:00:00.000Z',
    }, end)).toEqual({ label: 'Pending', statusClass: 'status-pending' });
    expect(accountStatusLabel({
      role: 'superadmin',
      status: 'approved',
      endDate: '2020-01-01T00:00:00.000Z',
    }, end).label).toBe('Approved');
    expect(accountStatusLabel({
      role: 'admin',
      status: 'approved',
      endDate: 'not-a-timestamp',
    }, end).label).toBe('Expired');
  });

  test('a regular admin cannot modify admin or superadmin profiles', () => {
    expect(canModifyManagedUser('admin', 'tester')).toBe(true);
    expect(canModifyManagedUser('admin', 'faculty')).toBe(true);
    expect(canModifyManagedUser('admin', undefined)).toBe(true);
    expect(canModifyManagedUser('admin', 'admin')).toBe(false);
    expect(canModifyManagedUser('admin', 'superadmin')).toBe(false);
    expect(canModifyManagedUser('faculty', 'tester')).toBe(false);
    expect(canModifyManagedUser('superadmin', 'admin')).toBe(true);
    expect(canModifyManagedUser('superadmin', 'faculty')).toBe(true);
    expect(canModifyManagedUser('superadmin', 'superadmin')).toBe(true);
    expect(canModifyManagedUser('tester', 'tester')).toBe(false);
  });
});
