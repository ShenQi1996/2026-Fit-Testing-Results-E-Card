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
