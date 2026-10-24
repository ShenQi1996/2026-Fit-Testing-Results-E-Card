import { getDoc, getDocs } from 'firebase/firestore';
import { clearMasterSchoolsCache, listMasterSchools } from './masterSchools';

const directorySnap = (names) => ({
  exists: () => names !== null,
  data: () => (names === null ? null : { names }),
});

beforeEach(() => {
  clearMasterSchoolsCache();
  getDoc.mockReset();
  getDocs.mockReset();
});

test('listMasterSchools reads the directory document once per session', async () => {
  getDoc.mockResolvedValue(directorySnap(['Zed School', 'Amy School']));

  await expect(listMasterSchools()).resolves.toEqual(['Amy School', 'Zed School']);
  await expect(listMasterSchools()).resolves.toEqual(['Amy School', 'Zed School']);

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
