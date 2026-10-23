import {
  LEGACY_USER_IDS,
  STATUS_BACKFILL,
  collectStatusBackfillIds,
  readFirebaseConfig,
} from '../../scripts/backfillUserStatus';

const doc = (id, data) => ({ id, data: () => data });

describe('legacy user status backfill', () => {
  test('includes Sam and the other two live users when they have no status', () => {
    const ids = collectStatusBackfillIds([
      doc('SX26kFfwDRM7OR4xVFECwg5QulG2', {
        email: 'qisam1989@gmail.com',
        name: 'Sam',
        role: 'admin',
      }),
      doc('Se0pO39E5RVY8xmy0mAScr1TdkY2', { role: 'tester' }),
      doc('Xy2DEHEJNRQNN9MAnHqTZ9imUoj2', { email: 'securefit2024@gmail.com' }),
    ]);

    expect(ids.sort()).toEqual([...LEGACY_USER_IDS].sort());
    expect(STATUS_BACKFILL).toEqual({ status: 'approved' });
  });

  test('still lists a known legacy id that the query did not return', () => {
    const ids = collectStatusBackfillIds([
      doc('SX26kFfwDRM7OR4xVFECwg5QulG2', { role: 'admin', status: 'approved' }),
    ]);

    expect(ids).toEqual([
      'Se0pO39E5RVY8xmy0mAScr1TdkY2',
      'Xy2DEHEJNRQNN9MAnHqTZ9imUoj2',
    ]);
  });

  test('leaves docs that already have a status, and includes other missing-status docs', () => {
    const ids = collectStatusBackfillIds([
      doc('SX26kFfwDRM7OR4xVFECwg5QulG2', { role: 'admin', status: 'approved' }),
      doc('Se0pO39E5RVY8xmy0mAScr1TdkY2', { status: 'pending' }),
      doc('Xy2DEHEJNRQNN9MAnHqTZ9imUoj2', { status: 'rejected' }),
      doc('extra-user', { role: 'tester' }),
    ]);

    expect(ids).toEqual(['extra-user']);
  });

  test('reads the same Firebase project as the app', () => {
    expect(readFirebaseConfig().projectId).toBe('fit-test-result-e-card-2026');
  });
});
