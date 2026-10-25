import { addDoc, getDoc, getDocs, setDoc, where, writeBatch } from 'firebase/firestore';
import {
  countFitTestsForUser,
  getFitTestCountsByUser,
  getUserFitTests,
  saveFitTest,
  updateFitTest,
} from './firebaseDb';

const userDoc = (role, extra = {}) => ({
  exists: () => true,
  data: () => ({
    role,
    status: 'approved',
    schools: role === 'admin' ? ['Helene College of Nursing'] : [],
    ...extra,
  }),
});

const NOW = new Date(2026, 9, 24, 12, 0, 0);
const recentCreatedAt = { toDate: () => new Date(2026, 9, 20, 8, 0, 0) };

const fitTestDoc = (id, issueDate) => ({
  id,
  ref: { id },
  data: () => ({
    userId: 'tester-1',
    issueDate,
    createdAt: recentCreatedAt,
  }),
});

const reproDocs = [
  fitTestDoc('live-1', '10/24/2026'),
  fitTestDoc('live-2', '01/15/2025'),
  fitTestDoc('old-issue', '10/23/2022'),
];

beforeEach(() => {
  getDoc.mockReset();
  getDocs.mockReset();
  where.mockClear();
  writeBatch.mockClear();
  getDocs.mockResolvedValue({ docs: [] });
});

test('counts match the results list for 2 live records plus a 4-year-old issue date', async () => {
  getDoc.mockResolvedValue(userDoc('admin'));
  getDocs.mockImplementation(async (q) => {
    const userConstraint = (q?.args || []).find((arg) => arg?.kind === 'where' && arg.field === 'userId');
    if (userConstraint?.value === 'tester-2') return { docs: [] };
    return { docs: reproDocs };
  });

  const listed = await getUserFitTests('tester-1', { now: NOW });
  expect(listed.map((record) => record.id).sort()).toEqual(['live-1', 'live-2']);
  expect(writeBatch).not.toHaveBeenCalled();

  await expect(countFitTestsForUser('tester-1', { now: NOW })).resolves.toBe(2);
  await expect(getFitTestCountsByUser('admin-1', ['tester-1', 'tester-2', 'tester-1'], { now: NOW })).resolves.toEqual({
    'tester-1': 2,
  });

  expect(where).toHaveBeenCalledWith('userId', '==', 'tester-1');
  expect(where).not.toHaveBeenCalledWith('createdAt', '<', expect.anything());
});

test('getUserFitTests does not write lookup or verification documents', async () => {
  getDocs.mockResolvedValue({
    docs: [{
      id: 'ft-1',
      data: () => ({
        userId: 'tester-1',
        clientName: 'Test Person',
        issueDate: '10/24/2026',
        createdAt: { toDate: () => new Date('2026-10-24T00:00:00.000Z') },
      }),
    }],
  });

  const records = await getUserFitTests('tester-1', { now: NOW });

  expect(records.map((record) => record.id)).toEqual(['ft-1']);
  expect(writeBatch).not.toHaveBeenCalled();
});

test('a missing composite index is surfaced instead of an empty results list', async () => {
  const indexError = new Error(
    'The query requires an index. You can create it here: https://console.firebase.google.com/example'
  );
  indexError.code = 'failed-precondition';
  getDocs.mockRejectedValue(indexError);

  await expect(getUserFitTests('tester-1', { now: NOW })).rejects.toMatchObject({
    message: 'FIREBASE_INDEX_REQUIRED',
    indexUrl: 'https://console.firebase.google.com/example',
  });
  await expect(countFitTestsForUser('tester-1', { now: NOW })).rejects.toBe(indexError);
});

test('medical restriction notes are stored apart from the fit test and preferred on read', async () => {
  addDoc.mockClear();
  setDoc.mockClear();
  writeBatch.mockClear();

  await saveFitTest('tester-1', {
    clientName: 'Ada Lovelace',
    schoolsList: 'Helene College of Nursing',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: '  asthma  ',
  });

  expect(addDoc).not.toHaveBeenCalled();
  expect(writeBatch).toHaveBeenCalledTimes(1);
  const batch = writeBatch.mock.results[0].value;
  expect(batch.commit).toHaveBeenCalledTimes(1);
  const fitWrite = batch.set.mock.calls.find((call) => call[0].args[1] === 'fitTests');
  const noteWrite = batch.set.mock.calls.find((call) => call[0].args[1] === 'fitTestMedicalNotes');
  expect(fitWrite[1].testerMedicalRestrictionsReceived).toBeUndefined();
  expect(fitWrite[1].testerMedicalRestrictionsNote).toBeUndefined();
  expect(noteWrite[0].args.slice(1)).toEqual(['fitTestMedicalNotes', fitWrite[0].args[2]]);
  expect(noteWrite[1]).toEqual(expect.objectContaining({
    fitTestId: fitWrite[0].args[2],
    userId: 'tester-1',
    updatedBy: 'tester-1',
    schoolsList: 'Helene College of Nursing',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'asthma',
  }));

  const fitDocs = [
    {
      id: 'ft-1',
      data: () => ({
        userId: 'tester-1',
        issueDate: '10/24/2026',
        createdAt: recentCreatedAt,
        testerMedicalRestrictionsReceived: false,
        testerMedicalRestrictionsNote: 'legacy',
      }),
    },
    {
      id: 'ft-2',
      data: () => ({
        userId: 'tester-1',
        issueDate: '10/24/2026',
        createdAt: recentCreatedAt,
        testerMedicalRestrictionsReceived: false,
        testerMedicalRestrictionsNote: 'kept on the old record',
      }),
    },
  ];
  let reads = 0;
  getDocs.mockImplementation(async () => {
    reads += 1;
    if (reads === 1) return { docs: fitDocs };
    return {
      docs: [{
        id: 'ft-1',
        data: () => ({
          userId: 'tester-1',
          testerMedicalRestrictionsReceived: true,
          testerMedicalRestrictionsNote: 'side note',
        }),
      }],
    };
  });

  const listed = await getUserFitTests('tester-1', { now: NOW });
  const byId = Object.fromEntries(listed.map((record) => [record.id, record]));
  expect(byId['ft-1'].testerMedicalRestrictionsReceived).toBe(true);
  expect(byId['ft-1'].testerMedicalRestrictionsNote).toBe('side note');
  expect(byId['ft-2'].testerMedicalRestrictionsReceived).toBeUndefined();
  expect(byId['ft-2'].testerMedicalRestrictionsNote).toBeUndefined();
});

test('a failed medical-notes read still returns fit tests without inline notes', async () => {
  const fitDocs = [{
    id: 'ft-1',
    data: () => ({
      userId: 'tester-1',
      issueDate: '10/24/2026',
      createdAt: recentCreatedAt,
      testerMedicalRestrictionsReceived: true,
      testerMedicalRestrictionsNote: 'legacy inline',
    }),
  }];
  let reads = 0;
  getDocs.mockImplementation(async () => {
    reads += 1;
    if (reads === 1) return { docs: fitDocs };
    throw new Error('notes unavailable');
  });

  const listed = await getUserFitTests('tester-1', { now: NOW });

  expect(listed).toHaveLength(1);
  expect(listed[0].id).toBe('ft-1');
  expect(listed[0].testerMedicalRestrictionsReceived).toBeUndefined();
  expect(listed[0].testerMedicalRestrictionsNote).toBeUndefined();
});

test('an in-scope admin edit clears legacy inline notes in the same batch as the update', async () => {
  writeBatch.mockClear();
  const stored = {
    userId: 'tester-1',
    schoolsList: 'Helene College of Nursing',
    clientName: 'Ada Lovelace',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'legacy inline',
  };
  getDoc.mockImplementation(async (ref) => {
    const name = ref?.args?.[1];
    if (name === 'users') return userDoc('admin');
    if (name === 'fitTests') return { exists: () => true, data: () => stored };
    return { exists: () => false, data: () => null };
  });

  await updateFitTest('ft-1', {
    clientName: 'Ada Lovelace',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: '  updated note  ',
  }, 'admin-1');

  const batch = writeBatch.mock.results[0].value;
  expect(batch.commit).toHaveBeenCalledTimes(1);
  const payload = batch.update.mock.calls[0][1];
  expect(payload.testerMedicalRestrictionsReceived).toEqual({ kind: 'deleteField' });
  expect(payload.testerMedicalRestrictionsNote).toEqual({ kind: 'deleteField' });
  expect(payload.clientName).toBe('Ada Lovelace');
  const noteWrite = batch.set.mock.calls.find((call) => call[0].args[1] === 'fitTestMedicalNotes');
  expect(noteWrite[1]).toEqual(expect.objectContaining({
    fitTestId: 'ft-1',
    userId: 'tester-1',
    updatedBy: 'admin-1',
    schoolsList: 'Helene College of Nursing',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'updated note',
  }));
});
