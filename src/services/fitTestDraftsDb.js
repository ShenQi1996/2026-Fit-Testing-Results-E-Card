// Unsent fit test drafts.
//
// A draft is a half-finished test result form saved by the person filling it in.
// It is not an OSHA record: no fit test, lookup, verification card, medical note
// doc or email is created for it, and its owner can hard delete it. Only the
// owner can read or change it (see fitTestDrafts in firestore.rules), so every
// list query filters on ownerUid to match the rules.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { INITIAL_FORM_DATA } from '../constants/initialFitTestForm';

export const FIT_TEST_DRAFTS_COLLECTION = 'fitTestDrafts';
export const FIT_TEST_DRAFTS_LIST_LIMIT = 50;

// Fields that are filled in from the signed-in user or the chosen school at send
// time, so a draft does not store them.
const DERIVED_FIELDS = new Set([
  'fitTester',
  'programAdministratorName',
  'programAdministratorContact',
]);

// Only plain form fields go into a draft. Signatures, verification tokens and any
// fit factor never do: signatures are captured again at send, and new tests are
// qualitative only.
export const DRAFT_FORM_FIELDS = Object.keys(INITIAL_FORM_DATA)
  .filter((field) => !DERIVED_FIELDS.has(field));

const draftValue = (value) => {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  return null;
};

export const toDraftFields = (formData = {}) => {
  const fields = {};
  DRAFT_FORM_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(formData, field)) {
      fields[field] = draftValue(formData[field]);
    }
  });
  fields.fitTestMethod = 'Qualitative';
  return fields;
};

// Turns a stored draft back into form fields. Unknown keys are dropped.
export const draftToFormFields = (draft = {}) => {
  const fields = {};
  DRAFT_FORM_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(draft, field) && draft[field] !== undefined) {
      fields[field] = draft[field];
    }
  });
  fields.fitTestMethod = 'Qualitative';
  return fields;
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
};

export const draftUpdatedMs = (draft = {}) => toMillis(draft.updatedAt) || toMillis(draft.createdAt);

const assertUser = (userId) => {
  if (!userId) {
    throw new Error('You must be signed in to save a draft.');
  }
};

/**
 * Save the form as a draft for userId. With no draftId a new draft is created.
 * Returns the draft id. Nothing is validated here: a draft may be incomplete.
 */
export const saveFitTestDraft = async (userId, formData, draftId = null) => {
  assertUser(userId);
  const fields = toDraftFields(formData);
  if (draftId) {
    await updateDoc(doc(db, FIT_TEST_DRAFTS_COLLECTION, draftId), {
      ...fields,
      ownerUid: userId,
      updatedAt: serverTimestamp(),
    });
    return draftId;
  }
  const ref = doc(collection(db, FIT_TEST_DRAFTS_COLLECTION));
  await setDoc(ref, {
    ...fields,
    ownerUid: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/** The signed-in user's own drafts, newest first. */
export const listFitTestDrafts = async (userId) => {
  if (!userId) return [];
  const snapshot = await getDocs(query(
    collection(db, FIT_TEST_DRAFTS_COLLECTION),
    where('ownerUid', '==', userId),
    limit(FIT_TEST_DRAFTS_LIST_LIMIT),
  ));
  const drafts = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {};
    if (data.ownerUid !== userId) return;
    drafts.push({ id: docSnap.id, ...data });
  });
  return drafts.sort((a, b) => draftUpdatedMs(b) - draftUpdatedMs(a));
};

/** Hard delete one of the signed-in user's drafts. */
export const deleteFitTestDraft = async (draftId) => {
  if (!draftId) return;
  await deleteDoc(doc(db, FIT_TEST_DRAFTS_COLLECTION, draftId));
};
