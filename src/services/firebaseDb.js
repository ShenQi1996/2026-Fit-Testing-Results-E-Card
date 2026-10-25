// Firebase Firestore Database Service
// Handles storing and retrieving fit test records

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  deleteField,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  calculateExpirationDate,
  getFitTestRetentionDate,
  isExpirationDatePast,
  isFitTestPastRetention,
  parseDateString,
} from '../utils/dateUtils';
import { notifyFitTestActivity } from '../utils/fitTestActivity';
import {
  buildLookupKey,
  normalizeClientName,
  normalizeDob,
  normalizeEmail,
} from '../utils/lookupKey';
import {
  createVerificationToken,
  isValidVerificationToken,
  normalizeVerificationToken,
} from '../utils/verificationToken';
import {
  USER_ROLES,
  USER_ROLE_ADMIN,
  USER_ROLE_FACULTY,
  USER_ROLE_SUPERADMIN,
  USER_ROLE_TESTER,
  accessBoundaryDate,
  accessDateInputValue,
  accessWindowOrderError,
  canModifyManagedUser,
  isAccessWindowOpen,
  isAdminOrAbove,
  isSuperAdmin,
} from '../utils/roles';
import { normalizeSchoolList } from '../utils/schoolScope';

const FIT_TESTS_COLLECTION = 'fitTests';
const FIT_TEST_DELETION_LOGS_COLLECTION = 'fitTestDeletionLogs';
const FIT_TEST_LOOKUPS_COLLECTION = 'fitTestLookups';
const FIT_TEST_VERIFICATIONS_COLLECTION = 'fitTestVerifications';
const FIT_TEST_MEDICAL_NOTES_COLLECTION = 'fitTestMedicalNotes';
const USERS_COLLECTION = 'users';
const MEDICAL_NOTE_MAX_LENGTH = 2000;

const LOOKUP_CARD_FIELDS = [
  'recipientEmail',
  'clientName',
  'dob',
  'testLocation',
  'issueDate',
  'expirationDate',
  'fitTestType',
  'respiratorMfg',
  'testingAgent',
  'maskSize',
  'model',
  'style',
  'fitTestMethod',
  'fitFactor',
  'result',
  'fitTester',
  'verificationToken',
];

const VERIFY_CARD_FIELDS = [
  'clientName',
  'testLocation',
  'issueDate',
  'expirationDate',
  'fitTestType',
  'respiratorMfg',
  'maskSize',
  'model',
  'style',
  'fitTestMethod',
  'fitFactor',
  'result',
  'fitTester',
];

const MEDICAL_NOTE_FIELDS = [
  'testerMedicalRestrictionsReceived',
  'testerMedicalRestrictionsNote',
];

const withoutMedicalNote = (data = {}) => {
  const rest = { ...data };
  MEDICAL_NOTE_FIELDS.forEach((field) => {
    delete rest[field];
  });
  return rest;
};

const medicalNoteFromRecord = (data = {}) => {
  const received = data.testerMedicalRestrictionsReceived === true;
  const note = received ? String(data.testerMedicalRestrictionsNote || '').trim() : '';
  if (note.length > MEDICAL_NOTE_MAX_LENGTH) {
    throw new Error('Medical restriction notes must be 2000 characters or fewer.');
  }
  return {
    testerMedicalRestrictionsReceived: received,
    testerMedicalRestrictionsNote: note,
  };
};

const hasMedicalNoteInput = (data = {}) => MEDICAL_NOTE_FIELDS.some((field) => (
  Object.prototype.hasOwnProperty.call(data, field)
));

const queueMedicalNote = (batch, fitTestId, ownerUserId, actorUserId, note, updatedAt, schoolsList) => {
  batch.set(doc(db, FIT_TEST_MEDICAL_NOTES_COLLECTION, fitTestId), {
    fitTestId,
    userId: ownerUserId,
    updatedBy: actorUserId,
    updatedAt,
    schoolsList: typeof schoolsList === 'string' ? schoolsList : '',
    ...note,
  });
};

const applyMedicalNote = (test, note) => {
  if (!note) return test;
  if (note.testerMedicalRestrictionsReceived !== true && note.testerMedicalRestrictionsReceived !== false) {
    return test;
  }
  return {
    ...test,
    testerMedicalRestrictionsReceived: note.testerMedicalRestrictionsReceived,
    testerMedicalRestrictionsNote: note.testerMedicalRestrictionsNote || '',
  };
};

const toLookupCardData = (record = {}) => {
  const data = {};
  LOOKUP_CARD_FIELDS.forEach((field) => {
    data[field] = record[field] || '';
  });
  return data;
};

const toVerifyCardData = (record = {}) => {
  const data = {};
  VERIFY_CARD_FIELDS.forEach((field) => {
    data[field] = record[field] || '';
  });
  return data;
};

const resolveVerificationToken = (record = {}) => {
  const existing = normalizeVerificationToken(record.verificationToken);
  return isValidVerificationToken(existing) ? existing : createVerificationToken();
};

const upsertFitTestVerification = async (token, record, fitTestId, userId) => {
  const verificationToken = normalizeVerificationToken(token);
  if (!isValidVerificationToken(verificationToken) || !fitTestId) return;

  const verifyRef = doc(db, FIT_TEST_VERIFICATIONS_COLLECTION, verificationToken);
  const existingSnap = await getDoc(verifyRef);
  if (existingSnap.exists() && isRevokedCard(existingSnap.data())) return;

  await setDoc(verifyRef, {
    ...toVerifyCardData({ ...record, verificationToken }),
    userId: userId || record.userId || '',
    fitTestId,
    verificationToken,
    updatedAt: Timestamp.now(),
  });
};

const isRevokedCard = (data) => data?.revokedAt != null && data.revokedAt !== '';

const isSoftDeletedFitTest = (data) => data?.deletedAt != null && data.deletedAt !== '';

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === 'function') {
    const asDate = value.toDate();
    return asDate && !Number.isNaN(asDate.getTime()) ? asDate.getTime() : 0;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const issueDateMs = (record = {}) => {
  const parsed = parseDateString(record.issueDate);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
};

/** Newest test first: test date decides, save time only breaks ties. */
const compareFitTestRecency = (a, b) => {
  const issueDiff = issueDateMs(b) - issueDateMs(a);
  if (issueDiff !== 0) return issueDiff;
  return toMillis(b.createdAt) - toMillis(a.createdAt);
};

/**
 * True when `candidate` is the later test, so a backdated entry entered after a
 * newer one cannot take over the client's resend card.
 */
const isLaterFitTest = (candidate, candidateCreatedMs, existing) => {
  const candidateIssue = issueDateMs(candidate);
  const existingIssue = issueDateMs(existing);
  if (candidateIssue !== existingIssue) return candidateIssue > existingIssue;
  return candidateCreatedMs >= (existing.testCreatedAtMs || 0);
};

const upsertFitTestLookup = async (lookupKey, record, fitTestId, userId) => {
  if (!lookupKey || !fitTestId) return;

  const lookupRef = doc(db, FIT_TEST_LOOKUPS_COLLECTION, lookupKey);
  const createdMs = toMillis(record.createdAt) || Date.now();
  const existingSnap = await getDoc(lookupRef);

  if (existingSnap.exists()) {
    const existing = existingSnap.data() || {};
    // A revoked lookup stays revoked. Nothing in the app clears revokedAt.
    if (isRevokedCard(existing)) return;
    const nextUserId = userId || record.userId || '';
    if (existing.userId && nextUserId && existing.userId !== nextUserId) return;
    // Re-pointing the same test is always allowed so admin edits still apply.
    if (existing.fitTestId !== fitTestId && !isLaterFitTest(record, createdMs, existing)) {
      return;
    }
  }

  await setDoc(lookupRef, {
    ...toLookupCardData(record),
    userId: userId || record.userId || '',
    fitTestId,
    lookupKey,
    testCreatedAtMs: createdMs,
    updatedAt: Timestamp.now(),
  });
};

/** Always recomputed from the record so key-format changes propagate on next write. */
const resolveLookupKey = async (record = {}) =>
  buildLookupKey(record.clientName, record.dob, record.recipientEmail);

export const USER_STATUS_PENDING = 'pending';
export const USER_STATUS_APPROVED = 'approved';
export const USER_STATUS_REJECTED = 'rejected';
export { USER_ROLES };
export const USER_STATUSES = [
  USER_STATUS_PENDING,
  USER_STATUS_APPROVED,
  USER_STATUS_REJECTED,
];

const permissionError = (message) => {
  const error = new Error(message);
  error.code = 'PERMISSION_DENIED';
  return error;
};

/** Missing or unknown status is pending. Approved and rejected pass through. */
export const normalizeUserStatus = (status) => (
  USER_STATUSES.includes(status) ? status : USER_STATUS_PENDING
);

const assertAdmin = async (userId) => {
  const access = await getUserAccessProfile(userId);
  if (access.status !== USER_STATUS_APPROVED || !isAdminOrAbove(access)) {
    throw permissionError('Only admin users can manage users.');
  }
  return access.role;
};

// Firestore `in` filters accept at most 30 values.
const FIRESTORE_IN_LIMIT = 30;

// Faculty results page. Schools with more live tests than this see the newest page.
export const FACULTY_RESULTS_LIMIT = 100;

export const CREATOR_ROLE_FIELD = 'creatorRole';
export const CREATOR_SCHOOL_FIELD = 'creatorSchool';

/** The one school a faculty account may read. A `schools` list is ignored. */
export const facultySchoolNames = (value) => {
  if (typeof value === 'string') {
    const school = value.trim();
    return school ? [school] : [];
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const school = typeof value.school === 'string' ? value.school.trim() : '';
  return school ? [school] : [];
};

const chunkValues = (values, size) => {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
};

const docsById = (snapshots) => {
  const byId = new Map();
  snapshots.forEach((snapshot) => {
    snapshot.forEach((docSnap) => {
      byId.set(docSnap.id, docSnap);
    });
  });
  return [...byId.values()];
};

// Scoped admins list one role at a time. Two `in` filters are not a valid query,
// and role == tester plus role == faculty reuse the same role + school index.
const listScopedRole = async (schools, role, extraConstraints = []) => {
  const scopedSchools = normalizeSchoolList(schools);
  if (scopedSchools.length === 0) return [];
  const snapshots = await Promise.all(
    chunkValues(scopedSchools, FIRESTORE_IN_LIMIT).map(async (chunk) => {
      try {
        return await getDocs(query(
          collection(db, USERS_COLLECTION),
          ...extraConstraints,
          where('role', '==', role),
          where('school', 'in', chunk),
        ));
      } catch (error) {
        // A missing composite index must not look like an empty school.
        if (isIndexError(error)) {
          console.error(
            'Firestore users query needs a composite index on role and school. Deploy firestore.indexes.json.',
            error,
          );
        }
        throw error;
      }
    })
  );
  return docsById(snapshots);
};

const listScopedSchoolStaff = async (schools, extraConstraints = []) => {
  const testers = await listScopedRole(schools, USER_ROLE_TESTER, extraConstraints);
  const faculty = await listScopedRole(schools, USER_ROLE_FACULTY, extraConstraints);
  const byId = new Map();
  [...testers, ...faculty].forEach((docSnap) => byId.set(docSnap.id, docSnap));
  return [...byId.values()];
};

const singleSchoolRole = (role) => role === USER_ROLE_TESTER || role === USER_ROLE_FACULTY;

const assertSuperAdmin = async (userId) => {
  const access = await getUserAccessProfile(userId);
  if (access.status !== USER_STATUS_APPROVED || !isSuperAdmin(access.role)) {
    throw permissionError('Only a super admin can grant or change admin access.');
  }
  return access.role;
};

const assertCanAssignRole = async (actorUserId, actorRole, targetUserId, currentRole, nextRole) => {
  const current = currentRole || USER_ROLE_TESTER;
  const next = nextRole || current;
  if (!USER_ROLES.includes(next)) {
    throw new Error('Invalid role. Must be tester, faculty, admin, or superadmin.');
  }
  if (actorUserId === targetUserId && isSuperAdmin(actorRole) && next !== USER_ROLE_SUPERADMIN) {
    throw permissionError('You cannot remove your own super admin role.');
  }
  // Tester and faculty stay with a scoped admin. Admin and superadmin do not.
  if (!singleSchoolRole(current) || !singleSchoolRole(next)) {
    await assertSuperAdmin(actorUserId);
  }
};

const toIso = (value) => value?.toDate?.()?.toISOString?.() || null;

const serializeUserDoc = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    email: data.email || '',
    name: data.name || '',
    role: data.role || 'tester',
    status: normalizeUserStatus(data.status),
    provider: data.provider || 'unknown',
    requestedAt: toIso(data.requestedAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    approvedAt: toIso(data.approvedAt),
    approvedBy: data.approvedBy || null,
    school: typeof data.school === 'string' ? data.school : '',
    schools: normalizeSchoolList(data.schools),
    startDate: toIso(data.startDate),
    endDate: toIso(data.endDate),
  };
};

/**
 * Save a fit test record
 * @param {string} userId - User ID who created the record
 * @param {object} fitTestData - Fit test form data
 * @returns {Promise<string>} Document ID of the saved record
 */
const creatorStampFor = (profile, schoolsList) => {
  const role = profile?.role || USER_ROLE_TESTER;
  if (role === USER_ROLE_ADMIN) {
    const ownSchools = normalizeSchoolList(profile?.schools);
    const listed = typeof schoolsList === 'string' ? schoolsList.trim() : '';
    if (!listed || !ownSchools.includes(listed)) {
      throw permissionError('Choose one of your schools before saving this fit test.');
    }
    return {
      [CREATOR_ROLE_FIELD]: role,
      [CREATOR_SCHOOL_FIELD]: listed,
    };
  }
  if (role === USER_ROLE_SUPERADMIN) {
    const listed = typeof schoolsList === 'string' ? schoolsList.trim() : '';
    if (!listed) {
      throw permissionError('Choose a school before saving this fit test.');
    }
    return {
      [CREATOR_ROLE_FIELD]: role,
      [CREATOR_SCHOOL_FIELD]: listed,
    };
  }
  const ownSchool = typeof profile?.school === 'string' ? profile.school.trim() : '';
  if (!ownSchool) {
    throw permissionError('A school is required on your profile before you can save a fit test.');
  }
  return {
    [CREATOR_ROLE_FIELD]: role,
    [CREATOR_SCHOOL_FIELD]: ownSchool,
  };
};

export const saveFitTest = async (userId, fitTestData) => {
  try {
    const access = await getUserAccessProfile(userId);
    if (access.role === USER_ROLE_FACULTY) {
      throw permissionError('Faculty cannot create fit test records.');
    }
    const notePresent = hasMedicalNoteInput(fitTestData);
    const note = notePresent ? medicalNoteFromRecord(fitTestData) : null;
    const clientData = withoutMedicalNote(fitTestData || {});
    delete clientData[CREATOR_ROLE_FIELD];
    delete clientData[CREATOR_SCHOOL_FIELD];
    const lookupKey = await resolveLookupKey(clientData);
    const verificationToken = resolveVerificationToken(clientData);
    const recordToSave = {
      ...clientData,
      verificationToken,
      ...creatorStampFor(access, clientData.schoolsList),
    };
    const createdAt = Timestamp.now();
    const retentionDate = retentionDateValue({ ...recordToSave, createdAt });
    const fitTestId = createVerificationToken();
    const docRef = doc(db, FIT_TESTS_COLLECTION, fitTestId);
    const batch = writeBatch(db);
    batch.set(docRef, {
      userId,
      ...recordToSave,
      lookupKey: lookupKey || null,
      createdAt,
      updatedAt: createdAt,
      ...(retentionDate ? { retentionDate } : {}),
    });
    if (note) {
      queueMedicalNote(
        batch,
        fitTestId,
        userId,
        userId,
        note,
        createdAt,
        recordToSave.schoolsList,
      );
    }
    await batch.commit();
    if (lookupKey) {
      await upsertFitTestLookup(lookupKey, recordToSave, docRef.id, userId);
    }
    await upsertFitTestVerification(verificationToken, recordToSave, docRef.id, userId);
    notifyFitTestActivity();
    return docRef.id;
  } catch (error) {
    console.error('Error saving fit test:', error);
    if (error.message === 'Medical restriction notes must be 2000 characters or fewer.') {
      throw error;
    }
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error('Failed to save fit test record. Please try again.');
  }
};

/** Timestamp for the same day isFitTestPastRetention uses. Null when undated. */
const retentionDateValue = (record) => {
  const date = getFitTestRetentionDate(record);
  return date ? Timestamp.fromDate(date) : null;
};

const isIndexError = (error) => (
  error?.code === 'failed-precondition'
  || error?.message?.toLowerCase().includes('index')
  || error?.message?.toLowerCase().includes('query requires an index')
);

const indexRequiredError = (error) => {
  const indexUrlMatch = error.message?.match(/https:\/\/[^\s)]+/);
  const indexError = new Error('FIREBASE_INDEX_REQUIRED');
  indexError.indexUrl = indexUrlMatch ? indexUrlMatch[0] : null;
  indexError.originalError = error;
  return indexError;
};

const mapFitTestDoc = (docSnap) => {
  const data = withoutMedicalNote(docSnap.data() || {});
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
  };
};

// Expired-record deletion is disabled. Lists and counts hide records past the
// retention window with isFitTestPastRetention. Nothing in the app deletes a
// fit test because of its age.

/**
 * Get all fit test records for a user. Does not delete expired records.
 * A missing userId + createdAt index is reported; it is not an empty list.
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of fit test records
 */
export const getUserFitTests = async (userId, options = {}) => {
  try {
    const now = options.now instanceof Date ? options.now : new Date();
    const q = query(
      collection(db, FIT_TESTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    // A notes failure must not hide the fit tests. Inline fields are already
    // stripped, including for faculty once that role reads this list, so a
    // failed notes read does not fall back to the legacy copy.
    let notesById = new Map();
    try {
      const notesSnap = await getDocs(query(
        collection(db, FIT_TEST_MEDICAL_NOTES_COLLECTION),
        where('userId', '==', userId),
      ));
      notesById = new Map(
        notesSnap.docs.map((noteSnap) => [noteSnap.id, noteSnap.data() || {}])
      );
    } catch (noteError) {
      console.error('Error fetching medical notes:', noteError);
    }

    return querySnapshot.docs
      .filter((docSnap) => !isSoftDeletedFitTest(docSnap.data() || {}))
      .filter((docSnap) => !isFitTestPastRetention(docSnap.data() || {}, now))
      .map((docSnap) => applyMedicalNote(mapFitTestDoc(docSnap), notesById.get(docSnap.id)));
  } catch (error) {
    console.error('Error fetching fit tests:', error);

    if (isIndexError(error)) {
      console.error(
        'Firestore fitTests query needs a composite index on userId and createdAt. Deploy firestore.indexes.json.',
        error,
      );
      throw indexRequiredError(error);
    }
    
    throw new Error('Failed to fetch fit test records. Please try again.');
  }
};

/**
 * Count of one user's fit tests still inside the retention window.
 * issueDate is MM/DD/YYYY, so a range query on it is not chronological, and
 * undated records stay in the results list. This applies the same
 * isFitTestPastRetention rule to that user's documents. A retentionDate
 * range would drop both undated cards and every card saved before the field
 * existed.
 * @param {string} userId
 * @param {{ now?: Date }} [options]
 * @returns {Promise<number>}
 */
export const countFitTestsForUser = async (userId, options = {}) => {
  if (!userId) return 0;
  const now = options.now instanceof Date ? options.now : new Date();
  let snapshot;
  try {
    snapshot = await getDocs(query(
      collection(db, FIT_TESTS_COLLECTION),
      where('userId', '==', userId),
    ));
  } catch (error) {
    if (isIndexError(error)) {
      console.error(
        'Firestore fitTests count needs an index on userId. Deploy firestore.indexes.json.',
        error,
      );
    }
    throw error;
  }
  return snapshot.docs
    .filter((docSnap) => !isSoftDeletedFitTest(docSnap.data() || {}))
    .filter((docSnap) => !isFitTestPastRetention(docSnap.data() || {}, now))
    .length;
};

const facultySchoolConstraint = (chunk) => (
  chunk.length === 1
    ? where(CREATOR_SCHOOL_FIELD, '==', chunk[0])
    : where(CREATOR_SCHOOL_FIELD, 'in', chunk)
);

/**
 * Fit tests whose creatorSchool is one of the faculty member's schools.
 * Matches the creatorSchool + createdAt composite index. Legacy tests with no
 * creatorSchool are not returned. Does not read the whole collection.
 * @param {string|string[]|object} schools
 * @param {{ now?: Date, limit?: number }} [options]
 * @returns {Promise<Array>}
 */
export const getFacultyFitTests = async (schools, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  if (
    schools
    && typeof schools === 'object'
    && !Array.isArray(schools)
    && schools.role === USER_ROLE_FACULTY
    && !isAccessWindowOpen(schools, now)
  ) {
    return [];
  }
  const scopedSchools = facultySchoolNames(schools);
  if (scopedSchools.length === 0) return [];
  const pageLimit = Number.isInteger(options.limit) && options.limit > 0
    ? options.limit
    : FACULTY_RESULTS_LIMIT;
  try {
    const snapshots = [];
    for (const chunk of chunkValues(scopedSchools, FIRESTORE_IN_LIMIT)) {
      snapshots.push(await getDocs(query(
        collection(db, FIT_TESTS_COLLECTION),
        facultySchoolConstraint(chunk),
        orderBy('createdAt', 'desc'),
        limit(pageLimit),
      )));
    }
    const byId = new Map();
    snapshots.forEach((snapshot) => {
      snapshot.docs.forEach((docSnap) => byId.set(docSnap.id, docSnap));
    });
    return [...byId.values()]
      .map(mapFitTestDoc)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .filter((record) => !isSoftDeletedFitTest(record))
      .filter((record) => !isFitTestPastRetention(record, now))
      .slice(0, pageLimit);
  } catch (error) {
    console.error('Error fetching faculty fit tests:', error);
    if (isIndexError(error)) {
      console.error(
        'Firestore fitTests query needs a composite index on creatorSchool and createdAt. That index is deployed separately from this change.',
        error,
      );
      throw indexRequiredError(error);
    }
    throw new Error('Failed to fetch fit test records. Please try again.');
  }
};

/**
 * Count of faculty-visible fit tests. Uses the same school, limit, and
 * retention filter as the results list, and skips soft-deleted records, so
 * the sidebar cannot show a higher number than the page.
 * @param {string|object} schools
 * @param {{ now?: Date, limit?: number }} [options]
 * @returns {Promise<number>}
 */
export const countFacultyFitTests = async (schools, options = {}) => {
  const records = await getFacultyFitTests(schools, options);
  return records.length;
};

/**
 * Admin-only: count fit test results for the given user ids.
 * Does not delete fit test records.
 * @param {string} adminUserId
 * @param {string[]} [userIds]
 * @returns {Promise<Record<string, number>>}
 */
export const getFitTestCountsByUser = async (adminUserId, userIds = [], options = {}) => {
  try {
    await assertAdmin(adminUserId);

    const ids = [...new Set(
      (Array.isArray(userIds) ? userIds : []).filter((id) => typeof id === 'string' && id)
    )];
    const counts = {};
    const batchSize = 10;
    for (let index = 0; index < ids.length; index += batchSize) {
      const batch = ids.slice(index, index + batchSize);
      const batchCounts = await Promise.all(batch.map((id) => countFitTestsForUser(id, options)));
      batch.forEach((id, batchIndex) => {
        if (batchCounts[batchIndex] > 0) counts[id] = batchCounts[batchIndex];
      });
    }

    return counts;
  } catch (error) {
    console.error('Error counting fit tests by user:', error);
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error('Failed to count test results. Please try again.');
  }
};

/**
 * Get a single fit test record by ID
 * @param {string} fitTestId - Fit test document ID
 * @returns {Promise<object>} Fit test record
 */
export const getFitTest = async (fitTestId) => {
  try {
    const docRef = doc(db, FIT_TESTS_COLLECTION, fitTestId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return mapFitTestDoc(docSnap);
    } else {
      throw new Error('Fit test record not found.');
    }
  } catch (error) {
    console.error('Error fetching fit test:', error);
    throw new Error('Failed to fetch fit test record. Please try again.');
  }
};

/**
 * Public resend lookup by name, date of birth, and the email on file.
 * Returns card fields for EmailJS, or null when there is no match.
 * @param {string} clientName
 * @param {string} dob
 * @param {string} recipientEmail
 * @returns {Promise<object|null>}
 */
export const lookupFitTestForResend = async (clientName, dob, recipientEmail) => {
  try {
    const lookupKey = await buildLookupKey(clientName, dob, recipientEmail);
    if (!lookupKey) return null;

    const lookupSnap = await getDoc(doc(db, FIT_TEST_LOOKUPS_COLLECTION, lookupKey));
    if (!lookupSnap.exists()) return null;

    const data = lookupSnap.data() || {};
    if (isRevokedCard(data)) return null;
    if (!data.recipientEmail?.trim()) return null;

    // Hash collision is extremely unlikely; still require all three to match.
    const nameMatches = normalizeClientName(data.clientName) === normalizeClientName(clientName);
    const dobMatches = normalizeDob(data.dob) === normalizeDob(dob);
    const emailMatches = normalizeEmail(data.recipientEmail) === normalizeEmail(recipientEmail);
    if (!nameMatches || !dobMatches || !emailMatches) return null;

    return {
      id: lookupSnap.id,
      ...toLookupCardData(data),
    };
  } catch (error) {
    console.error('Error looking up fit test for resend:', error);
    // Unpublished rules for fitTestLookups look identical to a bad name/DOB otherwise.
    if (error.code === 'permission-denied') {
      throw new Error('E-card resend is not enabled yet. Please contact Secure Fit.');
    }
    throw new Error('Unable to look up the e-card right now. Please try again.');
  }
};

const VERIFY_RATE_LIMIT_KEY = 'sf_verify_hits';
const VERIFY_RATE_WINDOW_MS = 60_000;
const VERIFY_RATE_MAX = 30;

const assertVerifyRateLimit = () => {
  if (typeof sessionStorage === 'undefined') return;
  const now = Date.now();
  let hits = [];
  try {
    hits = JSON.parse(sessionStorage.getItem(VERIFY_RATE_LIMIT_KEY) || '[]');
  } catch {
    hits = [];
  }
  hits = hits.filter((time) => now - time < VERIFY_RATE_WINDOW_MS);
  if (hits.length >= VERIFY_RATE_MAX) {
    const error = new Error('Too many verification checks. Please wait a moment and try again.');
    error.code = 'RATE_LIMITED';
    throw error;
  }
  hits.push(now);
  sessionStorage.setItem(VERIFY_RATE_LIMIT_KEY, JSON.stringify(hits));
};

/**
 * Public e-card verification by unguessable token. Never list this collection.
 * @param {string} token
 * @returns {Promise<{status: 'invalid'|'expired'|'failed'|'valid'|'revoked', card: object|null}>}
 */
export const lookupFitTestForVerification = async (token) => {
  const verificationToken = normalizeVerificationToken(token);
  if (!isValidVerificationToken(verificationToken)) {
    return { status: 'invalid', card: null };
  }

  try {
    assertVerifyRateLimit();
    const verifySnap = await getDoc(
      doc(db, FIT_TEST_VERIFICATIONS_COLLECTION, verificationToken)
    );
    if (!verifySnap.exists()) {
      return { status: 'invalid', card: null };
    }

    const data = verifySnap.data() || {};
    if (isRevokedCard(data)) {
      return { status: 'revoked', card: null };
    }

    const card = toVerifyCardData(data);
    if (!card.expirationDate && card.issueDate) {
      card.expirationDate = calculateExpirationDate(card.issueDate);
    }
    const expired = isExpirationDatePast(card.expirationDate);
    const passed = (card.result || '').trim().toLowerCase() === 'pass';

    let status = 'valid';
    if (expired) status = 'expired';
    else if (!passed) status = 'failed';

    return { status, card };
  } catch (error) {
    console.error('Error looking up fit test for verification:', error);
    if (error.code === 'RATE_LIMITED') throw error;
    if (error.code === 'permission-denied') {
      throw new Error('E-card verification is not enabled yet. Please contact Secure Fit.');
    }
    throw new Error('Unable to verify the e-card right now. Please try again.');
  }
};

/**
 * Attach a verification token to an existing record so PDFs and resends scan correctly.
 * @param {object} record
 * @param {string} [userId]
 * @returns {Promise<object>}
 */
export const ensureFitTestVerification = async (record, userId) => {
  if (!record) return record;

  const verificationToken = resolveVerificationToken(record);
  const nextRecord = { ...record, verificationToken };

  if (record.id && record.verificationToken !== verificationToken) {
    try {
      await updateDoc(doc(db, FIT_TESTS_COLLECTION, record.id), {
        verificationToken,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error saving verification token on fit test:', error);
    }
  }

  if (record.id) {
    await upsertFitTestVerification(
      verificationToken,
      nextRecord,
      record.id,
      userId || record.userId
    );
    const lookupKey = await resolveLookupKey(nextRecord);
    if (lookupKey) {
      await upsertFitTestLookup(lookupKey, nextRecord, record.id, userId || record.userId);
    }
  }

  return nextRecord;
};

/**
 * Update a fit test record
 * @param {string} fitTestId - Fit test document ID
 * @param {object} updates - Fields to update
 * @param {string} userId - User ID of the user making the update (for authorization check)
 * @returns {Promise<void>}
 */
const LOCKED_FIT_TEST_FIELDS = ['result', 'issueDate', 'expirationDate', 'retentionDate'];
const LOCKED_FIT_TEST_MESSAGE = 'The result, test date, expiration date, and retention date cannot be changed after the record is saved.';
const EDIT_HISTORY_SKIP = new Set([
  'updatedAt',
  'createdAt',
  'lookupKey',
  'verificationToken',
  'lastEditId',
]);

const sameStoredValue = (left, right) => {
  if (left === right) return true;
  return left == null && right == null;
};

const editHistoryValue = (value) => (value === undefined ? null : value);

const isDeleteSentinel = (value) => (
  value != null
  && typeof value === 'object'
  && (value.kind === 'deleteField' || value._methodName === 'deleteField')
);

const latestRemainingFitTest = async (lookupKey, removedFitTestId) => {
  if (!lookupKey) return null;
  const siblingsSnapshot = await getDocs(
    query(collection(db, FIT_TESTS_COLLECTION), where('lookupKey', '==', lookupKey))
  );
  const remaining = siblingsSnapshot.docs
    .filter((docSnap) => docSnap.id !== removedFitTestId)
    .map(mapFitTestDoc)
    .filter((record) => !isSoftDeletedFitTest(record) && !isFitTestPastRetention(record))
    .sort(compareFitTestRecency);
  return remaining[0] || null;
};

const queueLookupUpsert = async (batch, lookupKey, record, fitTestId, userId) => {
  if (!lookupKey || !fitTestId) return false;
  const lookupRef = doc(db, FIT_TEST_LOOKUPS_COLLECTION, lookupKey);
  const existingSnap = await getDoc(lookupRef);
  const nextUserId = userId || record.userId || '';
  if (existingSnap.exists()) {
    const existing = existingSnap.data() || {};
    if (isRevokedCard(existing)) return false;
    if (existing.userId && nextUserId && existing.userId !== nextUserId) return false;
    const createdMs = toMillis(record.createdAt) || Date.now();
    if (existing.fitTestId !== fitTestId && !isLaterFitTest(record, createdMs, existing)) {
      return false;
    }
  }
  batch.set(lookupRef, {
    ...toLookupCardData(record),
    userId: nextUserId,
    fitTestId,
    lookupKey,
    testCreatedAtMs: toMillis(record.createdAt) || Date.now(),
    updatedAt: Timestamp.now(),
  });
  return true;
};

const queueLookupRevokeIfCurrent = async (batch, lookupKey, fitTestId) => {
  if (!lookupKey) return;
  const lookupRef = doc(db, FIT_TEST_LOOKUPS_COLLECTION, lookupKey);
  const lookupSnap = await getDoc(lookupRef);
  if (!lookupSnap.exists()) return;
  const data = lookupSnap.data() || {};
  if (fitTestId && data.fitTestId !== fitTestId) return;
  if (isRevokedCard(data)) return;
  batch.update(lookupRef, { revokedAt: serverTimestamp() });
};

export const updateFitTest = async (fitTestId, updates, userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required to update fit test records.');
    }

    const access = await getUserAccessProfile(userId);
    if (!isAdminOrAbove(access)) {
      const error = new Error('Only admin users can edit test results.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }

    const docRef = doc(db, FIT_TESTS_COLLECTION, fitTestId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      throw new Error('Fit test record not found.');
    }
    const existing = existingSnap.data() || {};
    if (isSoftDeletedFitTest(existing)) {
      throw new Error('This fit test record is already hidden.');
    }
    const lockedChange = LOCKED_FIT_TEST_FIELDS.find((field) => (
      Object.prototype.hasOwnProperty.call(updates, field)
      && !sameStoredValue(updates[field], existing[field])
    ));
    if (lockedChange) {
      throw new Error(LOCKED_FIT_TEST_MESSAGE);
    }

    const notePresent = hasMedicalNoteInput(updates);
    const note = notePresent ? medicalNoteFromRecord(updates) : null;
    const writable = withoutMedicalNote(updates || {});
    LOCKED_FIT_TEST_FIELDS.forEach((field) => {
      delete writable[field];
    });
    delete writable[CREATOR_ROLE_FIELD];
    delete writable[CREATOR_SCHOOL_FIELD];

    const schoolsList = typeof existing.schoolsList === 'string' ? existing.schoolsList : '';
    const canStripLegacyNotes = isSuperAdmin(access.role)
      || (schoolsList !== '' && normalizeSchoolList(access.schools).includes(schoolsList));
    if (canStripLegacyNotes) {
      MEDICAL_NOTE_FIELDS.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(existing, field)) {
          writable[field] = deleteField();
        }
      });
    }

    const oldValues = {};
    const newValues = {};
    Object.keys(writable)
      .filter((field) => !EDIT_HISTORY_SKIP.has(field) && writable[field] !== undefined)
      .filter((field) => !sameStoredValue(
        isDeleteSentinel(writable[field]) ? null : writable[field],
        existing[field],
      ))
      .forEach((field) => {
        // A missing key means the field was absent. An explicit null stays,
        // because that is different from a field the document never had.
        if (Object.prototype.hasOwnProperty.call(existing, field)) {
          oldValues[field] = editHistoryValue(existing[field]);
        }
        if (!isDeleteSentinel(writable[field])) {
          newValues[field] = editHistoryValue(writable[field]);
        }
      });
    const changes = { old: oldValues, new: newValues };
    const changedFields = new Set(
      Object.keys(writable).filter((field) => (
        !EDIT_HISTORY_SKIP.has(field)
        && writable[field] !== undefined
        && !sameStoredValue(
          isDeleteSentinel(writable[field]) ? null : writable[field],
          existing[field],
        )
      )),
    );
    const changedWritable = {};
    changedFields.forEach((field) => {
      changedWritable[field] = writable[field];
    });

    const nextRecord = { ...existing };
    Object.keys(writable).forEach((field) => {
      if (isDeleteSentinel(writable[field])) {
        delete nextRecord[field];
      } else if (writable[field] !== undefined) {
        nextRecord[field] = writable[field];
      }
    });
    const previousKey = await resolveLookupKey(existing);
    const nextKey = await resolveLookupKey(nextRecord);
    const verificationToken = resolveVerificationToken(nextRecord);
    nextRecord.verificationToken = verificationToken;

    const ownerId = existing.userId || userId;
    const payload = {
      ...changedWritable,
      lookupKey: nextKey || null,
      verificationToken,
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    if (changedFields.size > 0) {
      const lastEditId = createVerificationToken();
      payload.lastEditId = lastEditId;
      batch.set(doc(db, FIT_TESTS_COLLECTION, fitTestId, 'editHistory', lastEditId), {
        fitTestId,
        editedBy: userId,
        editedAt: serverTimestamp(),
        fields: Array.from(changedFields),
        changes,
      });
    }
    batch.update(docRef, payload);
    if (note) {
      queueMedicalNote(
        batch,
        fitTestId,
        ownerId,
        userId,
        note,
        serverTimestamp(),
        schoolsList,
      );
    }

    const releasedKeys = new Set(
      [previousKey, existing.lookupKey].filter((key) => key && key !== nextKey)
    );
    let repointedKey = null;
    if (previousKey && previousKey !== nextKey) {
      const sibling = await latestRemainingFitTest(previousKey, fitTestId);
      if (sibling) {
        const handedOff = await queueLookupUpsert(
          batch,
          previousKey,
          sibling,
          sibling.id,
          sibling.userId || ownerId,
        );
        if (handedOff) repointedKey = previousKey;
      }
    }
    for (const key of releasedKeys) {
      if (key === repointedKey) continue;
      await queueLookupRevokeIfCurrent(batch, key, fitTestId);
    }
    if (nextKey) {
      await queueLookupUpsert(batch, nextKey, nextRecord, fitTestId, ownerId);
    }
    if (isValidVerificationToken(verificationToken)) {
      const verifyRef = doc(db, FIT_TEST_VERIFICATIONS_COLLECTION, verificationToken);
      const verifySnap = await getDoc(verifyRef);
      if (!verifySnap.exists() || !isRevokedCard(verifySnap.data())) {
        batch.set(verifyRef, {
          ...toVerifyCardData({ ...nextRecord, verificationToken }),
          userId: ownerId,
          fitTestId,
          verificationToken,
          updatedAt: Timestamp.now(),
        });
      }
    }
    await batch.commit();
    notifyFitTestActivity();
  } catch (error) {
    console.error('Error updating fit test:', error);
    if (
      error.code === 'PERMISSION_DENIED'
      || error.message === 'Medical restriction notes must be 2000 characters or fewer.'
      || error.message === LOCKED_FIT_TEST_MESSAGE
      || error.message === 'Fit test record not found.'
      || error.message === 'User ID is required to update fit test records.'
      || error.message === 'This fit test record is already hidden.'
    ) {
      throw error;
    }
    throw new Error('Failed to update fit test record. Please try again.');
  }
};

/**
 * Soft-delete a fit test. The document stays so the record is kept until the
 * next fit test. A reason is required, and a deletion log entry is written.
 * @param {string} fitTestId
 * @param {string} userId
 * @param {string} reason
 * @returns {Promise<void>}
 */
export const deleteFitTest = async (fitTestId, userId, reason) => {
  try {
    if (!userId) {
      throw new Error('User ID is required to delete fit test records.');
    }
    const deleteReason = typeof reason === 'string' ? reason.trim() : '';
    if (!deleteReason) {
      throw new Error('A reason is required to remove a fit test from the list.');
    }
    if (deleteReason.length > 500) {
      throw new Error('The reason must be 500 characters or fewer.');
    }

    const access = await getUserAccessProfile(userId);
    if (access.status !== USER_STATUS_APPROVED || !isAdminOrAbove(access)) {
      const error = new Error('Only admin users can delete test results.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }

    const docRef = doc(db, FIT_TESTS_COLLECTION, fitTestId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      throw new Error('Fit test record not found.');
    }
    const existing = existingSnap.data() || {};
    if (isSoftDeletedFitTest(existing)) {
      throw new Error('This fit test record is already hidden.');
    }
    const recordSchool = typeof existing.schoolsList === 'string' ? existing.schoolsList : '';
    if (!isSuperAdmin(access.role) && !normalizeSchoolList(access.schools).includes(recordSchool)) {
      throw permissionError('You can only remove fit tests for your schools.');
    }

    const lookupKeys = new Set();
    if (typeof existing.lookupKey === 'string' && existing.lookupKey) {
      lookupKeys.add(existing.lookupKey);
    }
    try {
      const resolvedKey = await resolveLookupKey(existing);
      if (resolvedKey) lookupKeys.add(resolvedKey);
    } catch (lookupError) {
      console.error('Error resolving lookup key during soft delete:', lookupError);
    }

    // Hand a still-live sibling the lookup inside this batch. A revoked lookup
    // cannot be cleared, so a sibling only takes a key that is not yet revoked.
    const lookupPlans = [];
    for (const lookupKey of lookupKeys) {
      const lookupRef = doc(db, FIT_TEST_LOOKUPS_COLLECTION, lookupKey);
      const lookupSnap = await getDoc(lookupRef);
      if (!lookupSnap.exists()) continue;
      const lookup = lookupSnap.data() || {};
      if (lookup.fitTestId && lookup.fitTestId !== fitTestId) continue;
      if (isRevokedCard(lookup)) continue;
      const sibling = await latestRemainingFitTest(lookupKey, fitTestId);
      const lookupUserId = lookup.userId || existing.userId || '';
      const siblingUserId = sibling?.userId || '';
      const siblingSchool = typeof sibling?.schoolsList === 'string' ? sibling.schoolsList : '';
      const canHandOff = Boolean(sibling)
        && siblingUserId === lookupUserId
        && siblingSchool === recordSchool;
      lookupPlans.push({
        lookupKey,
        lookupRef,
        lookupUserId,
        sibling: canHandOff ? sibling : null,
      });
    }

    const batch = writeBatch(db);
    batch.update(docRef, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      deleteReason,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, FIT_TEST_DELETION_LOGS_COLLECTION, fitTestId), {
      fitTestId,
      userId: existing.userId || '',
      schoolsList: recordSchool,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      deleteReason,
    });

    const verificationToken = normalizeVerificationToken(existing.verificationToken);
    if (isValidVerificationToken(verificationToken)) {
      const verifySnap = await getDoc(doc(db, FIT_TEST_VERIFICATIONS_COLLECTION, verificationToken));
      if (verifySnap.exists() && !isRevokedCard(verifySnap.data())) {
        batch.update(doc(db, FIT_TEST_VERIFICATIONS_COLLECTION, verificationToken), {
          revokedAt: serverTimestamp(),
        });
      }
    }

    for (const plan of lookupPlans) {
      if (plan.sibling) {
        batch.set(plan.lookupRef, {
          ...toLookupCardData(plan.sibling),
          userId: plan.lookupUserId,
          fitTestId: plan.sibling.id,
          lookupKey: plan.lookupKey,
          testCreatedAtMs: toMillis(plan.sibling.createdAt) || Date.now(),
          updatedAt: Timestamp.now(),
        });
      } else {
        batch.update(plan.lookupRef, { revokedAt: serverTimestamp() });
      }
    }

    const noteRef = doc(db, FIT_TEST_MEDICAL_NOTES_COLLECTION, fitTestId);
    const noteSnap = await getDoc(noteRef);
    if (noteSnap.exists()) {
      batch.delete(noteRef);
    }

    await batch.commit();
    notifyFitTestActivity();
  } catch (error) {
    console.error('Error deleting fit test:', error);
    if (error.code === 'PERMISSION_DENIED') {
      throw error;
    }
    if (error.message === 'A reason is required to remove a fit test from the list.'
      || error.message === 'The reason must be 500 characters or fewer.'
      || error.message === 'Fit test record not found.'
      || error.message === 'This fit test record is already hidden.') {
      throw error;
    }
    throw new Error('Failed to delete fit test record. Please try again.');
  }
};

/**
 * Get user role from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<string>} User role ('tester', 'faculty', 'admin', or 'superadmin')
 */
export const getUserRole = async (userId) => {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      return userData.role || 'tester'; // Default to tester if role not set
    }
    return 'tester';
  } catch (error) {
    console.error('Error getting user role:', error);
    // Default to tester on error
    return 'tester';
  }
};

/**
 * Ensure a user profile document exists for auth users
 * New profiles are created as pending approval by default.
 * @param {object} userInfo - { uid, email, name, provider }
 * @returns {Promise<{isNewUser: boolean}>}
 */
export const ensureUserProfile = async (userInfo) => {
  try {
    if (!userInfo?.uid) {
      throw new Error('User ID is required to ensure profile.');
    }

    const userDocRef = doc(db, USERS_COLLECTION, userInfo.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      await setDoc(userDocRef, {
        email: userInfo.email || '',
        name: userInfo.name || '',
        role: 'tester',
        status: USER_STATUS_PENDING,
        provider: userInfo.provider || 'unknown',
        requestedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return { isNewUser: true };
    }

    // Backfill is best-effort. A rules denial must not block sign-in.
    try {
      await updateDoc(userDocRef, {
        email: userInfo.email || userDocSnap.data().email || '',
        name: userInfo.name || userDocSnap.data().name || '',
        updatedAt: Timestamp.now(),
      });
    } catch (backfillError) {
      console.error('Error backfilling user profile:', backfillError);
    }

    return { isNewUser: false };
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    throw new Error('Failed to initialize user profile. Please try again.');
  }
};

/**
 * Get user access profile including role + approval status
 * Missing or unknown status is pending. Only 'approved' can sign in.
 * @param {string} userId - User ID
 * @returns {Promise<{role: string, status: string}>}
 */
const emptyAccessProfile = () => ({
  role: 'tester',
  status: USER_STATUS_PENDING,
  school: '',
  schools: [],
  startDate: null,
  endDate: null,
});

export const getUserAccessProfile = async (userId) => {
  try {
    if (!userId) return emptyAccessProfile();

    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) return emptyAccessProfile();

    const data = userDocSnap.data() || {};
    return {
      role: data.role || 'tester',
      status: normalizeUserStatus(data.status),
      school: typeof data.school === 'string' ? data.school : '',
      schools: normalizeSchoolList(data.schools),
      startDate: toIso(data.startDate),
      endDate: toIso(data.endDate),
    };
  } catch (error) {
    console.error('Error getting user access profile:', error);
    return emptyAccessProfile();
  }
};

/**
 * Admin-only: list users waiting for approval
 * @param {string} adminUserId - Current admin user ID
 * @returns {Promise<Array>}
 */
export const getPendingUsers = async (adminUserId) => {
  try {
    const actorRole = await assertAdmin(adminUserId);
    const pendingConstraint = where('status', '==', USER_STATUS_PENDING);
    let docSnaps;
    if (isSuperAdmin(actorRole)) {
      const querySnapshot = await getDocs(query(
        collection(db, USERS_COLLECTION),
        pendingConstraint,
      ));
      docSnaps = [];
      querySnapshot.forEach((docSnap) => docSnaps.push(docSnap));
    } else {
      const { schools } = await getUserAccessProfile(adminUserId);
      docSnaps = await listScopedSchoolStaff(schools, [pendingConstraint]);
    }

    const users = [];
    docSnaps.forEach((docSnap) => {
      const pendingUser = serializeUserDoc(docSnap);
      if (!canModifyManagedUser(actorRole, pendingUser.role)) return;
      users.push(pendingUser);
    });

    users.sort((a, b) => {
      const dateA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const dateB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return dateA - dateB;
    });

    return users;
  } catch (error) {
    console.error('Error fetching pending users:', error);
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error('Failed to fetch pending users. Please try again.');
  }
};

/**
 * Admin-only: list all user profiles
 * @param {string} adminUserId
 * @returns {Promise<Array>}
 */
export const getAllUsers = async (adminUserId) => {
  try {
    const actorRole = await assertAdmin(adminUserId);
    let docSnaps;
    if (isSuperAdmin(actorRole)) {
      const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
      docSnaps = [];
      querySnapshot.forEach((docSnap) => docSnaps.push(docSnap));
    } else {
      const { schools } = await getUserAccessProfile(adminUserId);
      docSnaps = await listScopedSchoolStaff(schools);
    }

    const users = [];
    docSnaps.forEach((docSnap) => {
      users.push(serializeUserDoc(docSnap));
    });

    users.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error('Failed to fetch users. Please try again.');
  }
};

/**
 * Admin-only: update editable user profile fields
 * @param {string} adminUserId
 * @param {string} targetUserId
 * @param {{name?: string, email?: string, role?: string, status?: string}} updates
 */
export const updateManagedUser = async (adminUserId, targetUserId, updates = {}) => {
  try {
    const actorRole = await assertAdmin(adminUserId);

    if (!targetUserId) {
      throw new Error('Target user ID is required.');
    }

    const targetRef = doc(db, USERS_COLLECTION, targetUserId);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) {
      throw new Error('User profile not found.');
    }

    const current = targetSnap.data() || {};
    const nextName = typeof updates.name === 'string' ? updates.name.trim() : current.name || '';
    const nextEmail = typeof updates.email === 'string' ? updates.email.trim() : current.email || '';
    const nextRole = updates.role || current.role || USER_ROLE_TESTER;
    const nextStatus = normalizeUserStatus(
      updates.status !== undefined ? updates.status : current.status
    );
    const profileChanged = nextName !== (current.name || '') || nextEmail !== (current.email || '');
    if (profileChanged && !isSuperAdmin(actorRole)) {
      throw permissionError('Only a super admin can edit name or email. Admins can update tester role and status.');
    }

    await assertCanAssignRole(adminUserId, actorRole, targetUserId, current.role, nextRole);
    if (!USER_STATUSES.includes(nextStatus)) {
      throw new Error('Invalid status.');
    }
    if (targetUserId === adminUserId && nextStatus !== USER_STATUS_APPROVED) {
      throw new Error('You cannot change your own approval status.');
    }

    const payload = {
      name: nextName,
      email: nextEmail,
      role: nextRole,
      status: nextStatus,
      updatedAt: Timestamp.now(),
    };

    const nextFacultySchool = nextRole === USER_ROLE_FACULTY
      ? (
        typeof updates.school === 'string'
          ? updates.school.trim()
          : (typeof current.school === 'string' ? current.school.trim() : '')
      )
      : '';
    if (nextRole === USER_ROLE_FACULTY && !nextFacultySchool) {
      throw new Error('Choose one school for this faculty member.');
    }
    if (
      nextRole === USER_ROLE_FACULTY
      && (!isSuperAdmin(actorRole) || adminUserId === targetUserId)
      && (
        normalizeSchoolList(current.schools).length > 0
        || (typeof current.school === 'string' ? current.school.trim() : '') !== nextFacultySchool
      )
    ) {
      throw permissionError('Faculty must have exactly one school.');
    }

    if (nextStatus !== current.status) {
      if (nextStatus === USER_STATUS_APPROVED || nextStatus === USER_STATUS_REJECTED) {
        payload.approvedAt = Timestamp.now();
        payload.approvedBy = adminUserId;
      }
    }

    // School tags are super-admin only, and not on the caller's own document.
    if (isSuperAdmin(actorRole) && adminUserId !== targetUserId) {
      if (nextRole === USER_ROLE_FACULTY) {
        const currentSchool = typeof current.school === 'string' ? current.school : '';
        if (nextFacultySchool !== currentSchool) payload.school = nextFacultySchool;
        if (Object.prototype.hasOwnProperty.call(current, 'schools')) {
          payload.schools = deleteField();
        }
      } else if (typeof updates.school === 'string') {
        const nextSchool = updates.school.trim();
        const currentSchool = typeof current.school === 'string' ? current.school : '';
        if (nextSchool !== currentSchool) payload.school = nextSchool;
      }
      if (nextRole !== USER_ROLE_FACULTY && Array.isArray(updates.schools)) {
        const nextSchools = normalizeSchoolList(updates.schools);
        const currentSchools = normalizeSchoolList(current.schools);
        const sameSchools = nextSchools.length === currentSchools.length
          && nextSchools.every((school, index) => school === currentSchools[index]);
        if (!sameSchools) payload.schools = nextSchools;
      }
      if (nextRole === USER_ROLE_ADMIN || nextRole === USER_ROLE_FACULTY) {
        const currentStart = accessDateInputValue(current.startDate);
        const currentEnd = accessDateInputValue(current.endDate);
        const nextStart = updates.startDate !== undefined ? String(updates.startDate || '') : currentStart;
        const nextEnd = updates.endDate !== undefined ? String(updates.endDate || '') : currentEnd;
        const orderError = accessWindowOrderError(nextStart, nextEnd);
        if (orderError) throw new Error(orderError);
        if (updates.startDate !== undefined && nextStart !== currentStart) {
          if (!nextStart) {
            payload.startDate = deleteField();
          } else {
            const start = accessBoundaryDate(nextStart, 'start');
            if (!start) throw new Error('Access start date is invalid.');
            payload.startDate = Timestamp.fromDate(start);
          }
        }
        if (updates.endDate !== undefined && nextEnd !== currentEnd) {
          if (!nextEnd) {
            payload.endDate = deleteField();
          } else {
            const end = accessBoundaryDate(nextEnd, 'end');
            if (!end) throw new Error('Access end date is invalid.');
            payload.endDate = Timestamp.fromDate(end);
          }
        }
      }
    }

    await updateDoc(targetRef, payload);
    const refreshed = await getDoc(targetRef);
    return serializeUserDoc(refreshed);
  } catch (error) {
    console.error('Error updating managed user:', error);
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error(error.message || 'Failed to update user.');
  }
};

/**
 * Admin-only: delete a user profile document.
 * The Auth login is left in place. The client SDK cannot delete another
 * user's Auth account on the Spark plan.
 * @param {string} adminUserId
 * @param {string} targetUserId
 */
export const deleteManagedUser = async (adminUserId, targetUserId) => {
  try {
    const actorRole = await assertAdmin(adminUserId);

    if (!targetUserId) {
      throw new Error('Target user ID is required.');
    }
    if (targetUserId === adminUserId) {
      throw new Error('You cannot delete your own account from Users Management.');
    }

    const targetRef = doc(db, USERS_COLLECTION, targetUserId);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) {
      throw new Error('User profile not found.');
    }
    await assertCanAssignRole(
      adminUserId,
      actorRole,
      targetUserId,
      targetSnap.data()?.role,
      USER_ROLE_TESTER
    );

    await deleteDoc(targetRef);
  } catch (error) {
    console.error('Error deleting managed user:', error);
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error(error.message || 'Failed to delete user.');
  }
};

/**
 * Admin-only: create Firestore user profile with canonical schema
 * @param {string} adminUserId
 * @param {string} targetUserId
 * @param {object} userData
 */
export const createManagedUserProfile = async (adminUserId, targetUserId, userData = {}) => {
  try {
    const actorRole = await assertAdmin(adminUserId);

    if (!targetUserId) {
      throw new Error('Target user ID is required.');
    }

    const email = (userData.email || '').trim();
    const name = (userData.name || '').trim();
    const role = userData.role || USER_ROLE_TESTER;
    if (role === USER_ROLE_SUPERADMIN) {
      throw permissionError('A super admin cannot be created from the client.');
    }
    await assertCanAssignRole(adminUserId, actorRole, targetUserId, USER_ROLE_TESTER, role);
    const status = normalizeUserStatus(userData.status);
    const provider = userData.provider || 'password';

    if (!email) {
      throw new Error('Email is required.');
    }
    if (!USER_STATUSES.includes(status)) {
      throw new Error('Invalid status.');
    }

    const now = Timestamp.now();
    const profile = {
      email,
      name,
      role,
      status,
      provider,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (singleSchoolRole(role)) {
      const requestedSchool = typeof userData.school === 'string' ? userData.school.trim() : '';
      if (role === USER_ROLE_FACULTY && !requestedSchool) {
        throw new Error('Choose one school for this faculty member.');
      }
      if (isSuperAdmin(actorRole)) {
        if (requestedSchool) profile.school = requestedSchool;
      } else {
        const { schools } = await getUserAccessProfile(adminUserId);
        if (schools.length === 0) {
          throw permissionError('You have no schools assigned, so you cannot add this user.');
        }
        const school = requestedSchool || (schools.length === 1 ? schools[0] : '');
        if (!schools.includes(school)) {
          throw permissionError('Choose one of your schools before adding this user.');
        }
        profile.school = school;
      }
    }

    if (role === USER_ROLE_ADMIN) {
      const requestedSchools = normalizeSchoolList(userData.schools);
      if (!isSuperAdmin(actorRole)) {
        throw permissionError('Only a super admin can assign schools to an admin.');
      }
      if (requestedSchools.length === 0) {
        throw new Error('Choose at least one school for this admin.');
      }
      profile.schools = requestedSchools;
    }

    if (status === USER_STATUS_APPROVED || status === USER_STATUS_REJECTED) {
      profile.approvedAt = now;
      profile.approvedBy = adminUserId;
    }

    const targetRef = doc(db, USERS_COLLECTION, targetUserId);
    await setDoc(targetRef, profile);
    const createdSnap = await getDoc(targetRef);
    return serializeUserDoc(createdSnap);
  } catch (error) {
    console.error('Error creating managed user profile:', error);
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error(error.message || 'Failed to create user profile.');
  }
};

/**
 * Admin-only: approve or reject a user
 * @param {string} adminUserId - Current admin user ID
 * @param {string} targetUserId - Target user ID to update
 * @param {'approved'|'rejected'} nextStatus - New status
 * @returns {Promise<void>}
 */
export const updateUserApprovalStatus = async (adminUserId, targetUserId, nextStatus) => {
  try {
    await updateManagedUser(adminUserId, targetUserId, { status: nextStatus });
  } catch (error) {
    console.error('Error updating user approval status:', error);
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error(error.message || 'Failed to update approval status.');
  }
};

/**
 * Set a user's role. The actor must be an admin or super admin.
 * Only a super admin may assign admin or superadmin.
 * @param {string} actorUserId
 * @param {string} targetUserId
 * @param {string} role
 * @returns {Promise<void>}
 */
export const setUserRole = async (actorUserId, targetUserId, role) => {
  try {
    const actorRole = await assertAdmin(actorUserId);
    if (!targetUserId) {
      throw new Error('Target user ID is required.');
    }
    const userDocRef = doc(db, USERS_COLLECTION, targetUserId);
    const userDocSnap = await getDoc(userDocRef);
    const currentRole = userDocSnap.exists() ? userDocSnap.data()?.role : USER_ROLE_TESTER;
    if (!userDocSnap.exists() && role === USER_ROLE_SUPERADMIN) {
      throw permissionError('A super admin cannot be created from the client.');
    }
    await assertCanAssignRole(actorUserId, actorRole, targetUserId, currentRole, role);

    if (userDocSnap.exists()) {
      const data = userDocSnap.data() || {};
      const payload = {
        role,
        updatedAt: Timestamp.now(),
      };
      if (role === USER_ROLE_FACULTY) {
        const school = typeof data.school === 'string' ? data.school.trim() : '';
        if (!school) {
          throw new Error('Choose one school for this faculty member.');
        }
        if (Object.prototype.hasOwnProperty.call(data, 'schools')) {
          if (!isSuperAdmin(actorRole)) {
            throw permissionError('Faculty must have exactly one school.');
          }
          payload.schools = deleteField();
        }
      }
      if (!USER_STATUSES.includes(data.status)) {
        payload.status = USER_STATUS_PENDING;
      }
      await setDoc(userDocRef, payload, { merge: true });
    } else {
      if (role === USER_ROLE_FACULTY) {
        throw new Error('Choose one school for this faculty member.');
      }
      await setDoc(userDocRef, {
        role,
        status: USER_STATUS_PENDING,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    console.error('Error setting user role:', error);
    if (error.code === 'PERMISSION_DENIED') throw error;
    throw new Error(error.message || 'Failed to set user role. Please try again.');
  }
};

export {
  getUserSolutionProfiles,
  saveUserSolutionProfile,
  deleteUserSolutionProfile,
  reorderUserSolutionProfiles,
  setDefaultSolutionProfile,
  getUserSchoolProfiles,
  saveUserSchoolProfile,
  deleteUserSchoolProfile,
  setDefaultSchoolProfile,
  reorderUserSchoolProfiles,
} from './profilesDb';

/**
 * Backfill expiration dates for existing fit test records.
 * Calculates expiration date as issueDate + 1 year for records missing expirationDate.
 * Security rules reject the write: expirationDate is locked after the record is created.
 * @param {string} userId - User ID (optional, if provided only backfills user's records)
 * @param {number} batchSize - Number of records to process per batch (default: 100)
 * @returns {Promise<{processed: number, updated: number}>} Statistics about the backfill
 */
export const backfillExpirationDates = async (userId = null, batchSize = 100) => {
  try {
    let q = query(collection(db, FIT_TESTS_COLLECTION));
    if (userId) {
      q = query(collection(db, FIT_TESTS_COLLECTION), where('userId', '==', userId));
    }
    
    const querySnapshot = await getDocs(q);
    const recordsToUpdate = [];
    
    // Find records missing expirationDate but having issueDate
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.issueDate && !data.expirationDate) {
        const expirationDate = calculateExpirationDate(data.issueDate);
        if (expirationDate) {
          recordsToUpdate.push({
            id: docSnap.id,
            expirationDate,
          });
        }
      }
    });
    
    // Update records in batches
    let updated = 0;
    for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchRecords = recordsToUpdate.slice(i, i + batchSize);
      
      batchRecords.forEach((record) => {
        const docRef = doc(db, FIT_TESTS_COLLECTION, record.id);
        batch.update(docRef, {
          expirationDate: record.expirationDate,
          updatedAt: Timestamp.now(),
        });
      });
      
      await batch.commit();
      updated += batchRecords.length;
    }
    
    return {
      processed: querySnapshot.size,
      updated,
    };
  } catch (error) {
    console.error('Error backfilling expiration dates:', error);
    throw new Error('Failed to backfill expiration dates. Please try again.');
  }
};

