import { getCountFromServer, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { ensureUserProfile, getAllUsers, getFitTestCountsByUser, getUserAccessProfile } from './firebaseDb';
import { loadFitTestList } from './fitTestListStore';
import { listMasterSchoolRecords } from './masterSchools';

jest.mock('./firebaseDb', () => {
  const actual = jest.requireActual('./firebaseDb');
  return actual;
});

const approvedAdmin = {
  exists: () => true,
  data: () => ({
    email: 'ada@example.com',
    name: 'Ada',
    role: 'admin',
    status: 'approved',
    schools: ['Helene College of Nursing', 'Example Second School'],
  }),
};

const countCalls = () => ({
  getDoc: getDoc.mock.calls.length,
  getDocs: getDocs.mock.calls.length,
  getCountFromServer: getCountFromServer.mock.calls.length,
  updateDoc: updateDoc.mock.calls.length,
});


beforeEach(() => {
  getDoc.mockReset();
  getDocs.mockReset();
  getCountFromServer.mockReset();
  updateDoc.mockReset();
  getDoc.mockImplementation(async (ref) => {
    if (ref?.args?.[1] === 'schoolDirectory') {
      return {
        exists: () => true,
        data: () => ({
          names: ['Helene College of Nursing', 'Example Second School'],
          programs: [
            { name: 'Helene College of Nursing', programAdministratorName: '', programAdministratorContact: '' },
            { name: 'Example Second School', programAdministratorName: '', programAdministratorContact: '' },
          ],
        }),
      };
    }
    return approvedAdmin;
  });
  getDocs.mockResolvedValue({ docs: [], forEach() {} });
  getCountFromServer.mockResolvedValue({ data: () => ({ count: 2 }) });
  updateDoc.mockResolvedValue();
});

test('records Firestore calls for sign-in, form, Results, and Users after the reductions', async () => {
  // Sign-in: one profile read, no write when email and name already match.
  const afterSignInStart = countCalls();
  await ensureUserProfile({
    uid: 'admin-1',
    email: 'ada@example.com',
    name: 'Ada',
    provider: 'password',
  });
  const access = await getUserAccessProfile('admin-1');
  expect(access.role).toBe('admin');
  const signIn = {
    getDoc: getDoc.mock.calls.length - afterSignInStart.getDoc,
    getDocs: getDocs.mock.calls.length - afterSignInStart.getDocs,
    getCountFromServer: getCountFromServer.mock.calls.length - afterSignInStart.getCountFromServer,
    updateDoc: updateDoc.mock.calls.length - afterSignInStart.updateDoc,
  };
  expect(signIn).toEqual({ getDoc: 1, getDocs: 0, getCountFromServer: 0, updateDoc: 0 });

  // Form page: sidebar list + one school directory read, even with two schools.
  const afterFormStart = countCalls();
  await loadFitTestList({
    uid: 'admin-1',
    role: 'admin',
    schools: ['Helene College of Nursing', 'Example Second School'],
  });
  await listMasterSchoolRecords();
  const formPage = {
    getDoc: getDoc.mock.calls.length - afterFormStart.getDoc,
    getDocs: getDocs.mock.calls.length - afterFormStart.getDocs,
    getCountFromServer: getCountFromServer.mock.calls.length - afterFormStart.getCountFromServer,
    updateDoc: updateDoc.mock.calls.length - afterFormStart.updateDoc,
  };

  // Results page after the form: the shared list is already loaded.
  const afterResultsStart = countCalls();
  await loadFitTestList({
    uid: 'admin-1',
    role: 'admin',
    schools: ['Helene College of Nursing', 'Example Second School'],
  });
  const resultsPage = {
    getDoc: getDoc.mock.calls.length - afterResultsStart.getDoc,
    getDocs: getDocs.mock.calls.length - afterResultsStart.getDocs,
    getCountFromServer: getCountFromServer.mock.calls.length - afterResultsStart.getCountFromServer,
    updateDoc: updateDoc.mock.calls.length - afterResultsStart.updateDoc,
  };
  expect(resultsPage).toEqual({ getDoc: 0, getDocs: 0, getCountFromServer: 0, updateDoc: 0 });

  // Users page: one users collection read + one aggregate count per user, no second pending query.
  const afterUsersStart = countCalls();
  await getAllUsers('admin-1');
  await getFitTestCountsByUser('admin-1', ['tester-1', 'tester-2']);
  const usersPage = {
    getDoc: getDoc.mock.calls.length - afterUsersStart.getDoc,
    getDocs: getDocs.mock.calls.length - afterUsersStart.getDocs,
    getCountFromServer: getCountFromServer.mock.calls.length - afterUsersStart.getCountFromServer,
    updateDoc: updateDoc.mock.calls.length - afterUsersStart.updateDoc,
  };

  // Keep the measured after counts in the assertion message for the report.
  expect({ signIn, formPage, resultsPage, usersPage }).toEqual({
    signIn: { getDoc: 1, getDocs: 0, getCountFromServer: 0, updateDoc: 0 },
    formPage: { getDoc: 1, getDocs: 2, getCountFromServer: 0, updateDoc: 0 },
    resultsPage: { getDoc: 0, getDocs: 0, getCountFromServer: 0, updateDoc: 0 },
    usersPage: { getDoc: 0, getDocs: 2, getCountFromServer: 2, updateDoc: 0 },
  });
});
