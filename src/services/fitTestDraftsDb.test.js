import {
  deleteDoc,
  getDocs,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  DRAFT_FORM_FIELDS,
  deleteFitTestDraft,
  draftToFormFields,
  listFitTestDrafts,
  saveFitTestDraft,
  toDraftFields,
} from './fitTestDraftsDb';
import { createInitialFormData } from '../constants/initialFitTestForm';

jest.mock('../config/firebase', () => ({ db: {} }));

const ts = (ms) => ({ toMillis: () => ms });

beforeEach(() => {
  jest.clearAllMocks();
});

test('a draft keeps form fields and the medical note, but never signatures, tokens, a fit factor or derived fields', () => {
  const fields = toDraftFields(createInitialFormData({
    clientName: 'Ada',
    fitFactor: 150,
    fitTestMethod: 'Quantitative',
    signatureDataUrl: 'data:x',
    testerSignatureDataUrl: 'data:y',
    fitTester: 'Tess',
    programAdministratorName: 'Pat',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'Private',
    somethingElse: 'dropped',
    style: undefined,
  }));
  expect(fields).toMatchObject({
    clientName: 'Ada',
    fitTestMethod: 'Qualitative',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'Private',
    style: null,
  });
  ['fitFactor', 'signatureDataUrl', 'testerSignatureDataUrl', 'verificationToken',
    'fitTester', 'programAdministratorName', 'programAdministratorContact', 'somethingElse']
    .forEach((key) => expect(fields).not.toHaveProperty(key));
  expect(Object.keys(fields).every((key) => DRAFT_FORM_FIELDS.includes(key))).toBe(true);
});

test('reopening a draft drops stored metadata and unknown keys', () => {
  const fields = draftToFormFields({
    id: 'd1',
    ownerUid: 'u1',
    createdAt: ts(1),
    updatedAt: ts(2),
    clientName: 'Ada',
    style: 'Duckbill',
    fitFactor: 99,
  });
  expect(fields).toEqual({ clientName: 'Ada', style: 'Duckbill', fitTestMethod: 'Qualitative' });
});

test('saving a new draft creates one doc owned by the user and sends nothing else', async () => {
  const id = await saveFitTestDraft('u1', createInitialFormData({ clientName: 'Ada' }));
  expect(id).toBe('mock-id');
  expect(setDoc).toHaveBeenCalledTimes(1);
  const payload = setDoc.mock.calls[0][1];
  expect(payload).toMatchObject({
    ownerUid: 'u1',
    clientName: 'Ada',
    createdAt: { kind: 'serverTimestamp' },
    updatedAt: { kind: 'serverTimestamp' },
  });
  expect(updateDoc).not.toHaveBeenCalled();
});

test('saving an open draft updates it without touching createdAt', async () => {
  const id = await saveFitTestDraft('u1', { clientName: 'Ada' }, 'draft-9');
  expect(id).toBe('draft-9');
  expect(setDoc).not.toHaveBeenCalled();
  const [ref, payload] = updateDoc.mock.calls[0];
  expect(ref.args.slice(1)).toEqual(['fitTestDrafts', 'draft-9']);
  expect(payload).toMatchObject({ ownerUid: 'u1', clientName: 'Ada', updatedAt: { kind: 'serverTimestamp' } });
  expect(payload).not.toHaveProperty('createdAt');
});

test('saving a draft needs a signed-in user', async () => {
  await expect(saveFitTestDraft('', {})).rejects.toThrow('signed in');
  expect(setDoc).not.toHaveBeenCalled();
});

test('listing filters on ownerUid, drops anything not owned, and sorts newest first', async () => {
  getDocs.mockResolvedValueOnce({
    forEach(cb) {
      [
        { id: 'old', data: () => ({ ownerUid: 'u1', updatedAt: ts(1) }) },
        { id: 'stranger', data: () => ({ ownerUid: 'u2', updatedAt: ts(9) }) },
        { id: 'new', data: () => ({ ownerUid: 'u1', updatedAt: ts(5) }) },
      ].forEach(cb);
    },
  });
  const drafts = await listFitTestDrafts('u1');
  expect(where).toHaveBeenCalledWith('ownerUid', '==', 'u1');
  expect(drafts.map((draft) => draft.id)).toEqual(['new', 'old']);
  expect(await listFitTestDrafts('')).toEqual([]);
});

test('deleting a draft hard deletes its doc', async () => {
  await deleteFitTestDraft('draft-3');
  expect(deleteDoc.mock.calls[0][0].args.slice(1)).toEqual(['fitTestDrafts', 'draft-3']);
  await deleteFitTestDraft('');
  expect(deleteDoc).toHaveBeenCalledTimes(1);
});

test('the renewal reminder opt-in is a draft field and defaults to false', () => {
  expect(DRAFT_FORM_FIELDS).toContain('renewalReminderOptIn');
  expect(toDraftFields(createInitialFormData()).renewalReminderOptIn).toBe(false);
  expect(toDraftFields(createInitialFormData({ renewalReminderOptIn: true })).renewalReminderOptIn).toBe(true);
  expect(draftToFormFields({ renewalReminderOptIn: true }).renewalReminderOptIn).toBe(true);
});
