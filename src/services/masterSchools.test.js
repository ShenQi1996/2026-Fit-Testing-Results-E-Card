import { getDoc, getDocs, writeBatch } from 'firebase/firestore';
import {
  addMasterSchool,
  clearMasterSchoolsCache,
  getMasterSchoolRecord,
  listMasterSchoolRecords,
  listMasterSchools,
} from './masterSchools';

const superAdminDoc = {
  exists: () => true,
  data: () => ({ role: 'superadmin', status: 'approved' }),
};

const directorySnap = (data) => ({
  exists: () => data !== null,
  data: () => data,
});

beforeEach(() => {
  clearMasterSchoolsCache();
  getDoc.mockReset();
  getDocs.mockReset();
  writeBatch.mockClear();
});

test('listMasterSchools reads the directory document once per session', async () => {
  getDoc.mockResolvedValue(directorySnap({ names: ['Zed School', 'Amy School'] }));

  await expect(listMasterSchools()).resolves.toEqual(['Amy School', 'Zed School']);
  await expect(listMasterSchools()).resolves.toEqual(['Amy School', 'Zed School']);

  expect(getDoc).toHaveBeenCalledTimes(1);
  expect(getDocs).not.toHaveBeenCalled();
});

test('listMasterSchoolRecords reads program fields from the directory document', async () => {
  getDoc.mockResolvedValue(directorySnap({
    names: ['Helene College of Nursing'],
    programs: [{
      name: 'Helene College of Nursing',
      programAdministratorName: 'Pat',
      programAdministratorContact: 'pat@example.com',
    }],
  }));

  await expect(listMasterSchoolRecords()).resolves.toEqual([{
    name: 'Helene College of Nursing',
    programAdministratorName: 'Pat',
    programAdministratorContact: 'pat@example.com',
  }]);
  await listMasterSchools();

  expect(getDoc).toHaveBeenCalledTimes(1);
  expect(getDocs).not.toHaveBeenCalled();
});

test('listMasterSchools falls back to the schools collection when the directory is missing', async () => {
  getDoc.mockResolvedValue(directorySnap(null));
  getDocs.mockResolvedValue({
    forEach(callback) {
      callback({ id: 'Zed School' });
      callback({ id: 'Amy School' });
    },
  });

  await expect(listMasterSchools()).resolves.toEqual(['Amy School', 'Zed School']);
  expect(getDocs).toHaveBeenCalledTimes(1);

  getDocs.mockClear();
  await listMasterSchools();
  expect(getDocs).not.toHaveBeenCalled();
});

test('addMasterSchool writes the school and the directory through the normal path', async () => {
  getDoc.mockResolvedValue(superAdminDoc);
  getDocs.mockResolvedValue({
    forEach(callback) {
      callback({
        id: 'Helene College of Nursing',
        data: () => ({
          name: 'Helene College of Nursing',
          programAdministratorName: 'Pat',
          programAdministratorContact: 'pat@example.com',
        }),
      });
    },
  });

  await expect(addMasterSchool('super-1', 'Example Program School', {
    programAdministratorName: '  ',
    programAdministratorContact: '',
  })).resolves.toEqual(['Example Program School', 'Helene College of Nursing']);

  const batch = writeBatch.mock.results[0].value;
  expect(batch.set).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      name: 'Example Program School',
      programAdministratorName: '',
      programAdministratorContact: '',
    }),
  );
  expect(batch.set).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      names: ['Example Program School', 'Helene College of Nursing'],
      programs: [
        {
          name: 'Example Program School',
          programAdministratorName: '',
          programAdministratorContact: '',
        },
        {
          name: 'Helene College of Nursing',
          programAdministratorName: 'Pat',
          programAdministratorContact: 'pat@example.com',
        },
      ],
    }),
  );
  expect(batch.commit).toHaveBeenCalled();
  expect(getDocs).toHaveBeenCalledTimes(1);
});

test('getMasterSchoolRecord returns blank program fields when the school doc is missing', async () => {
  getDoc.mockResolvedValue({ exists: () => false, data: () => null, id: 'missing' });

  await expect(getMasterSchoolRecord('Example Program School')).resolves.toEqual({
    name: 'Example Program School',
    programAdministratorName: '',
    programAdministratorContact: '',
  });
  expect(getDocs).not.toHaveBeenCalled();
});

describe('removing a school from users', () => {
  const masterSchools = require('./masterSchools');
  const SCHOOL_A = 'Alpha School';
  const SCHOOL_B = 'Beta School';

  const userSnap = (id, data) => ({ id, data: () => data, exists: () => true });
  const snapList = (snaps) => ({
    docs: snaps,
    empty: snaps.length === 0,
    forEach(callback) { snaps.forEach(callback); },
  });

  const mockFirestore = ({
    directory = [SCHOOL_A, SCHOOL_B],
    listUsers = [],
    singleUsers = [],
    actor = { role: 'superadmin', status: 'approved' },
  } = {}) => {
    getDoc.mockImplementation(async (ref) => {
      if (ref.id === 'names') return directorySnap({ names: directory });
      return { exists: () => true, data: () => actor, id: ref.id };
    });
    getDocs.mockImplementation(async (q) => {
      const filter = q.args.find((arg) => arg?.kind === 'where');
      if (filter?.field === 'schools') return snapList(listUsers);
      if (filter?.field === 'school') return snapList(singleUsers);
      return snapList([]);
    });
  };

  const batches = () => writeBatch.mock.results.map((result) => result.value);
  const updatesById = () => {
    const out = {};
    batches().forEach((batch) => {
      batch.update.mock.calls.forEach(([ref, payload]) => {
        out[ref.id] = payload;
      });
    });
    return out;
  };

  test('deletes the school and removes it from every user in the same batch', async () => {
    mockFirestore({
      listUsers: [
        userSnap('admin-two', { role: 'admin', name: 'Two', schools: [SCHOOL_A, SCHOOL_B] }),
        userSnap('admin-only', { role: 'admin', name: 'Only', schools: [SCHOOL_A] }),
        userSnap('admin-stale', { role: 'admin', schools: [SCHOOL_A, 'Old Gone School', SCHOOL_B] }),
        userSnap('faculty-legacy', { role: 'faculty', school: SCHOOL_B, schools: [SCHOOL_A] }),
        userSnap('super-1', { role: 'superadmin', schools: [SCHOOL_A, SCHOOL_B] }),
      ],
      singleUsers: [
        userSnap('tester-a', { role: 'tester', name: 'Tess', school: SCHOOL_A, status: 'approved' }),
        userSnap('faculty-a', { role: 'faculty', name: 'Fay', school: SCHOOL_A }),
        userSnap('admin-legacy', { role: 'admin', school: SCHOOL_A, schools: [SCHOOL_B] }),
      ],
    });

    const result = await masterSchools.removeMasterSchool('super-1', SCHOOL_A);

    expect(result.names).toEqual([SCHOOL_B]);
    expect(writeBatch).toHaveBeenCalledTimes(1);
    const [batch] = batches();
    const updates = updatesById();
    expect(updates['admin-two'].schools).toEqual({ kind: 'arrayRemove', values: [SCHOOL_A] });
    expect(updates['admin-stale'].schools).toEqual({
      kind: 'arrayRemove',
      values: [SCHOOL_A, 'Old Gone School'],
    });
    // An emptied list is deleted. Rules reject schools: [].
    expect(updates['admin-only'].schools).toEqual({ kind: 'deleteField' });
    // Faculty never keep a schools list.
    expect(updates['faculty-legacy'].schools).toEqual({ kind: 'deleteField' });
    // Nobody can change their own school tags, so the actor is skipped.
    expect(updates['super-1']).toBeUndefined();
    expect(result.skippedSelf).toBe(true);
    // A single school that was the deleted name is set to Leave unset ('').
    expect(updates['tester-a']).toEqual({ school: '', updatedAt: expect.anything() });
    expect(updates['admin-legacy']).toEqual({ school: '', updatedAt: expect.anything() });
    expect(masterSchools.UNSET_SCHOOL).toBe('');
    // Faculty must keep one school, so they are left alone and reported.
    expect(updates['faculty-a']).toBeUndefined();
    expect(result.facultyNeedingSchool.map((item) => item.id)).toEqual(['faculty-a']);
    // Role and status are never written.
    Object.values(updates).forEach((payload) => {
      expect(payload).not.toHaveProperty('role');
      expect(payload).not.toHaveProperty('status');
    });
    expect(result.unsetUsers.map((item) => item.id).sort()).toEqual(['admin-legacy', 'tester-a']);
    expect(result.leftWithoutSchools.map((item) => item.id)).toEqual(['admin-only']);
    expect(result.users.find((item) => item.id === 'admin-stale').schools).toEqual([SCHOOL_B]);

    expect(batch.delete).toHaveBeenCalledWith(expect.objectContaining({ id: SCHOOL_A }));
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'names' }),
      expect.objectContaining({ names: [SCHOOL_B] }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);

    const listQuery = getDocs.mock.calls
      .map(([q]) => q.args.find((arg) => arg?.kind === 'where'))
      .find((filter) => filter?.field === 'schools');
    expect(listQuery).toEqual({ kind: 'where', field: 'schools', op: 'array-contains', value: SCHOOL_A });
  });

  test('splits more than 500 user updates across batches and deletes the school last', async () => {
    const listUsers = Array.from({ length: 499 }, (_, index) => (
      userSnap(`admin-${index}`, { role: 'admin', schools: [SCHOOL_A, SCHOOL_B] })
    ));
    mockFirestore({ listUsers });

    await masterSchools.removeMasterSchool('super-1', SCHOOL_A);

    const all = batches();
    // 499 updates + 2 school writes is 501, so the school writes get their own batch.
    expect(all).toHaveLength(2);
    expect(all[0].update).toHaveBeenCalledTimes(499);
    expect(all[0].delete).not.toHaveBeenCalled();
    expect(all[1].update).not.toHaveBeenCalled();
    expect(all[1].delete).toHaveBeenCalledTimes(1);
    all.forEach((batch) => {
      const ops = batch.update.mock.calls.length + batch.delete.mock.calls.length
        + batch.set.mock.calls.length;
      expect(ops).toBeLessThanOrEqual(masterSchools.SCHOOL_CASCADE_BATCH_LIMIT);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });
  });

  test('1,001 users take three user batches with the school writes in the last one', async () => {
    const listUsers = Array.from({ length: 1001 }, (_, index) => (
      userSnap(`admin-${index}`, { role: 'admin', schools: [SCHOOL_A, SCHOOL_B] })
    ));
    mockFirestore({ listUsers });

    await masterSchools.removeMasterSchool('super-1', SCHOOL_A);

    const all = batches();
    expect(all.map((batch) => batch.update.mock.calls.length)).toEqual([500, 500, 1]);
    expect(all[2].delete).toHaveBeenCalledTimes(1);
  });

  test('a failed commit keeps the school in the cached list', async () => {
    mockFirestore({ listUsers: [userSnap('admin-two', { role: 'admin', schools: [SCHOOL_A, SCHOOL_B] })] });
    writeBatch.mockImplementationOnce(() => ({
      delete: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
      commit: jest.fn(async () => { throw new Error('PERMISSION_DENIED'); }),
    }));

    await expect(masterSchools.removeMasterSchool('super-1', SCHOOL_A)).rejects.toThrow('PERMISSION_DENIED');
    getDoc.mockClear();
    await expect(listMasterSchools()).resolves.toEqual([SCHOOL_A, SCHOOL_B]);
  });

  test('only an approved super admin can remove a school, and nothing is read or written first', async () => {
    mockFirestore({ actor: { role: 'admin', status: 'approved', schools: [SCHOOL_A] } });

    await expect(masterSchools.removeMasterSchool('admin-1', SCHOOL_A))
      .rejects.toThrow('Only a super admin can change the school list.');
    await expect(masterSchools.previewMasterSchoolRemoval('admin-1', SCHOOL_A))
      .rejects.toThrow('Only a super admin can change the school list.');
    expect(getDocs).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
  });

  test('preview counts affected users without writing', async () => {
    mockFirestore({
      listUsers: [
        userSnap('admin-two', { role: 'admin', schools: [SCHOOL_A, SCHOOL_B] }),
        userSnap('admin-only', { role: 'admin', schools: [SCHOOL_A] }),
      ],
      singleUsers: [userSnap('faculty-a', { role: 'faculty', school: SCHOOL_A })],
    });

    const preview = await masterSchools.previewMasterSchoolRemoval('super-1', SCHOOL_A);

    expect(preview.users.map((item) => item.id)).toEqual(['admin-two', 'admin-only']);
    expect(preview.leftWithoutSchools.map((item) => item.id)).toEqual(['admin-only']);
    expect(preview.facultyNeedingSchool.map((item) => item.id)).toEqual(['faculty-a']);
    expect(preview.unsetUsers).toEqual([]);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  test('stale names already on users can be cleaned up from the loaded list', async () => {
    mockFirestore({ directory: [SCHOOL_B] });
    const users = [
      { id: 'super-1', role: 'superadmin', schools: ['1test2 school'] },
      { id: 'admin-stale', role: 'admin', schools: ['1test2 school', SCHOOL_B] },
      { id: 'admin-orphan', role: 'admin', schools: ['1test2 school'] },
      { id: 'admin-fine', role: 'admin', schools: [SCHOOL_B] },
      { id: 'tester-1', role: 'tester', school: '1test2 school' },
    ];

    expect(masterSchools.findUsersWithRemovedSchools(users, [SCHOOL_B], 'super-1').map((item) => item.id))
      .toEqual(['admin-stale', 'admin-orphan', 'tester-1']);

    const result = await masterSchools.removeStaleSchoolsFromUsers('super-1', users);

    const updates = updatesById();
    expect(Object.keys(updates).sort()).toEqual(['admin-orphan', 'admin-stale', 'tester-1']);
    expect(updates['tester-1']).toEqual({ school: '', updatedAt: expect.anything() });
    expect(result.unsetUsers.map((item) => item.id)).toEqual(['tester-1']);
    expect(updates['admin-stale'].schools).toEqual({ kind: 'arrayRemove', values: ['1test2 school'] });
    expect(updates['admin-orphan'].schools).toEqual({ kind: 'deleteField' });
    expect(result.leftWithoutSchools.map((item) => item.id)).toEqual(['admin-orphan']);
    batches().forEach((batch) => expect(batch.delete).not.toHaveBeenCalled());
  });
});
