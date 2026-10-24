import {
  LEGACY_USER_IDS,
  STATUS_BACKFILL,
  assertApprovedSuperAdmin,
  collectStatusBackfillIds,
  readFirebaseConfig,
  shouldBackfillStatus,
} from '../../scripts/backfillUserStatus';

const doc = (id, data) => ({ id, data: () => data });

describe('legacy user status backfill', () => {
  test('fills status for a real profile that has a role and no status', () => {
    const ids = collectStatusBackfillIds([
      doc('SX26kFfwDRM7OR4xVFECwg5QulG2', {
        email: 'sam@example.com',
        name: 'Sam',
        role: 'superadmin',
      }),
      doc('reviewed-tester', { role: 'tester', email: 'tester@example.com' }),
    ]);

    expect(ids.sort()).toEqual([
      'SX26kFfwDRM7OR4xVFECwg5QulG2',
      'reviewed-tester',
    ]);
    expect(STATUS_BACKFILL).toEqual({ status: 'approved' });
    expect(LEGACY_USER_IDS).toContain('SX26kFfwDRM7OR4xVFECwg5QulG2');
  });

  test('does not guess at a legacy id the query did not return', () => {
    const ids = collectStatusBackfillIds([
      doc('SX26kFfwDRM7OR4xVFECwg5QulG2', { role: 'superadmin', status: 'approved', email: 'sam@example.com' }),
    ]);

    expect(ids).toEqual([]);
  });

  test('skips docs that already have a status', () => {
    const ids = collectStatusBackfillIds([
      doc('SX26kFfwDRM7OR4xVFECwg5QulG2', { role: 'superadmin', status: 'approved', name: 'Sam' }),
      doc('pending-tester', { role: 'tester', status: 'pending', email: 'a@example.com' }),
      doc('rejected-admin', { role: 'admin', status: 'rejected', email: 'b@example.com' }),
      doc('extra-user', { role: 'tester', email: 'extra@example.com' }),
    ]);

    expect(ids).toEqual(['extra-user']);
  });

  test('skips role-only setUserRole docs and docs with no role', () => {
    expect(shouldBackfillStatus({ role: 'tester' })).toBe(false);
    expect(shouldBackfillStatus({
      role: 'admin',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    })).toBe(false);
    expect(shouldBackfillStatus({ email: 'person@example.com', name: 'Pat' })).toBe(false);
    expect(shouldBackfillStatus({ role: 'owner', email: 'person@example.com' })).toBe(false);

    const ids = collectStatusBackfillIds([
      doc('Se0pO39E5RVY8xmy0mAScr1TdkY2', { role: 'tester' }),
      doc('Xy2DEHEJNRQNN9MAnHqTZ9imUoj2', { email: 'staff@example.com' }),
      doc('role-only', { role: 'admin', createdAt: 't', updatedAt: 't' }),
      doc('named', { role: 'tester', name: 'Pat' }),
    ]);

    expect(ids).toEqual(['named']);
  });

  test('skips the signed-in super admin even when their profile would qualify', () => {
    const ids = collectStatusBackfillIds([
      doc('super-1', { role: 'superadmin', name: 'Sam' }),
      doc('other', { role: 'admin', email: 'other@example.com' }),
    ], { skipIds: ['super-1'] });

    expect(ids).toEqual(['other']);
  });

  test('only an approved super admin may run the backfill', () => {
    expect(() => assertApprovedSuperAdmin({ role: 'superadmin', status: 'approved' })).not.toThrow();
    expect(() => assertApprovedSuperAdmin({ role: 'admin', status: 'approved' })).toThrow(/super admin/i);
    expect(() => assertApprovedSuperAdmin({ role: 'superadmin', status: 'pending' })).toThrow(/super admin/i);
    expect(() => assertApprovedSuperAdmin({ role: 'superadmin' })).toThrow(/super admin/i);
  });

  test('reads the same Firebase project as the app', () => {
    expect(readFirebaseConfig().projectId).toBe('fit-test-result-e-card-2026');
  });
});
