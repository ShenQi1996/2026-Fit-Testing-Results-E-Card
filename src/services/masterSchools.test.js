import { getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { addMasterSchool, getMasterSchoolRecord } from './masterSchools';

const superAdminDoc = {
  exists: () => true,
  data: () => ({ role: 'superadmin', status: 'approved' }),
};

beforeEach(() => {
  getDoc.mockReset();
  getDocs.mockReset();
  writeBatch.mockClear();
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

  await expect(addMasterSchool('super-1', 'Helen Fong', {
    programAdministratorName: '  ',
    programAdministratorContact: '',
  })).resolves.toEqual(['Helen Fong', 'Helene College of Nursing']);

  const batch = writeBatch.mock.results[0].value;
  expect(batch.set).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      name: 'Helen Fong',
      programAdministratorName: '',
      programAdministratorContact: '',
    }),
  );
  expect(batch.set).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      names: ['Helen Fong', 'Helene College of Nursing'],
      programs: [
        {
          name: 'Helen Fong',
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
});

test('getMasterSchoolRecord returns blank program fields when the school doc is missing', async () => {
  getDoc.mockResolvedValue({ exists: () => false, data: () => null, id: 'missing' });

  await expect(getMasterSchoolRecord('Helen Fong')).resolves.toEqual({
    name: 'Helen Fong',
    programAdministratorName: '',
    programAdministratorContact: '',
  });
});
