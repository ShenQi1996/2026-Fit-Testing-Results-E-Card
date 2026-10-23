// Firebase Firestore Database Service
// Handles storing and retrieving fit test records

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  calculateExpirationDate,
  isExpirationDatePast,
  isFitTestPastRetention,
  parseDateString,
} from '../utils/dateUtils';
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
  USER_ROLE_SUPERADMIN,
  USER_ROLE_TESTER,
  canModifyManagedUser,
  isAdminOrAbove,
  isSuperAdmin,
} from '../utils/roles';
import { normalizeSchoolList } from '../utils/schoolScope';

const FIRESTORE_BATCH_LIMIT = 400;

const FIT_TESTS_COLLECTION = 'fitTests';
const FIT_TEST_LOOKUPS_COLLECTION = 'fitTestLookups';
const FIT_TEST_VERIFICATIONS_COLLECTION = 'fitTestVerifications';
const USERS_COLLECTION = 'users';

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
  'result',
  'fitTester',
];

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
  if (!data.expirationDate && data.issueDate) {
    data.expirationDate = calculateExpirationDate(data.issueDate);
  }
  return data;
};

const resolveVerificationToken = (record = {}) => {
  const existing = normalizeVerificationToken(record.verificationToken);
  return isValidVerificationToken(existing) ? existing : createVerificationToken();
};

const upsertFitTestVerification = async (token, record, fitTestId, userId) => {
  const verificationToken = normalizeVerificationToken(token);
  if (!isValidVerificationToken(verificationToken) || !fitTestId) return;

  await setDoc(doc(db, FIT_TEST_VERIFICATIONS_COLLECTION, verificationToken), {
    ...toVerifyCardData({ ...record, verificationToken }),
    userId: userId || record.userId || '',
    fitTestId,
    verificationToken,
    updatedAt: Timestamp.now(),
  });
};

const deleteFitTestVerification = async (token) => {
  const verificationToken = normalizeVerificationToken(token);
  if (!isValidVerificationToken(verificationToken)) return;
  await deleteDoc(doc(db, FIT_TEST_VERIFICATIONS_COLLECTION, verificationToken));
};

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

const deleteFitTestLookupIfCurrent = async (lookupKey, fitTestId) => {
  if (!lookupKey) return;

  const lookupRef = doc(db, FIT_TEST_LOOKUPS_COLLECTION, lookupKey);
  const lookupSnap = await getDoc(lookupRef);
  if (!lookupSnap.exists()) return;
  if (fitTestId && lookupSnap.data()?.fitTestId !== fitTestId) return;
  await deleteDoc(lookupRef);
};

/** Always recomputed from the record so key-format changes propagate on next write. */
const resolveLookupKey = async (record = {}) =>
  buildLookupKey(record.clientName, record.dob, record.recipientEmail);

const syncLookupsForFitTests = async (tests = []) => {
  const sorted = [...tests].sort(compareFitTestRecency);
  const seenKeys = new Set();

  for (const test of sorted) {
    try {
      const lookupKey = await resolveLookupKey(test);
      const verificationToken = resolveVerificationToken(test);
      const recordUpdates = {};

      if (lookupKey && test.lookupKey !== lookupKey) {
        // Drops any key from an older format still stored on the record.
        recordUpdates.lookupKey = lookupKey;
      }
      if (test.verificationToken !== verificationToken) {
        recordUpdates.verificationToken = verificationToken;
        test.verificationToken = verificationToken;
      }
      if (Object.keys(recordUpdates).length > 0) {
        await updateDoc(doc(db, FIT_TESTS_COLLECTION, test.id), recordUpdates);
      }

      if (lookupKey && !seenKeys.has(lookupKey)) {
        seenKeys.add(lookupKey);
        await upsertFitTestLookup(lookupKey, test, test.id, test.userId);
      }
      await upsertFitTestVerification(verificationToken, test, test.id, test.userId);
    } catch (error) {
      console.error('Error syncing fit test lookup:', error);
    }
  }
};

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
  if (access.status !== USER_STATUS_APPROVED || !isAdminOrAbove(access.role)) {
    throw permissionError('Only admin users can manage users.');
  }
  return access.role;
};

// Firestore `in` filters accept at most 30 values.
const FIRESTORE_IN_LIMIT = 30;

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

// Scoped admins may list only testers whose school is in their own schools.
const listScopedTesters = async (schools, extraConstraints = []) => {
  const scopedSchools = normalizeSchoolList(schools);
  if (scopedSchools.length === 0) return [];
  const snapshots = await Promise.all(
    chunkValues(scopedSchools, FIRESTORE_IN_LIMIT).map((chunk) => getDocs(query(
      collection(db, USERS_COLLECTION),
      ...extraConstraints,
      where('role', '==', USER_ROLE_TESTER),
      where('school', 'in', chunk),
    )))
  );
  return docsById(snapshots);
};

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
    throw new Error('Invalid role. Must be tester, admin, or superadmin.');
  }
  if (actorUserId === targetUserId && isSuperAdmin(actorRole) && next !== USER_ROLE_SUPERADMIN) {
    throw permissionError('You cannot remove your own super admin role.');
  }
  if (current !== USER_ROLE_TESTER || next !== USER_ROLE_TESTER) {
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
  };
};

/**
 * Save a fit test record
 * @param {string} userId - User ID who created the record
 * @param {object} fitTestData - Fit test form data
 * @returns {Promise<string>} Document ID of the saved record
 */
export const saveFitTest = async (userId, fitTestData) => {
  try {
    const lookupKey = await resolveLookupKey(fitTestData);
    const verificationToken = resolveVerificationToken(fitTestData);
    const recordToSave = {
      ...fitTestData,
      verificationToken,
    };
    const docRef = await addDoc(collection(db, FIT_TESTS_COLLECTION), {
      userId,
      ...recordToSave,
      lookupKey: lookupKey || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    if (lookupKey) {
      await upsertFitTestLookup(lookupKey, recordToSave, docRef.id, userId);
    }
    await upsertFitTestVerification(verificationToken, recordToSave, docRef.id, userId);
    return docRef.id;
  } catch (error) {
    console.error('Error saving fit test:', error);
    throw new Error('Failed to save fit test record. Please try again.');
  }
};

const deleteExpiredFitTestDocuments = async (docs = []) => {
  const expiredDocs = docs.filter((docSnap) => isFitTestPastRetention(docSnap.data() || {}));
  if (expiredDocs.length === 0) {
    return 0;
  }

  for (let i = 0; i < expiredDocs.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = expiredDocs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const lookupRefsToDelete = [];

    await Promise.all(chunk.map(async (docSnap) => {
      try {
        const data = docSnap.data() || {};
        // Include any stored key so lookups from an older key format also go.
        const keys = new Set([await resolveLookupKey(data), data.lookupKey].filter(Boolean));

        for (const key of keys) {
          const lookupRef = doc(db, FIT_TEST_LOOKUPS_COLLECTION, key);
          const lookupSnap = await getDoc(lookupRef);
          if (lookupSnap.exists() && lookupSnap.data()?.fitTestId === docSnap.id) {
            lookupRefsToDelete.push(lookupRef);
          }
        }

        const verificationToken = normalizeVerificationToken(data.verificationToken);
        if (isValidVerificationToken(verificationToken)) {
          lookupRefsToDelete.push(doc(db, FIT_TEST_VERIFICATIONS_COLLECTION, verificationToken));
        }
      } catch (error) {
        console.error('Error resolving expired fit test lookup:', error);
      }
    }));

    const batch = writeBatch(db);
    chunk.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    lookupRefsToDelete.forEach((lookupRef) => {
      batch.delete(lookupRef);
    });
    await batch.commit();
  }

  return expiredDocs.length;
};

const mapFitTestDoc = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
  };
};

/**
 * After a record is removed, hand its resend card to that client's next most
 * recent test so they are not left without one.
 * @param {string} lookupKey
 * @param {string} removedFitTestId
 * @param {string} [fallbackUserId]
 * @returns {Promise<void>}
 */
const repointLookupToLatestRemaining = async (lookupKey, removedFitTestId, fallbackUserId) => {
  if (!lookupKey) return;

  try {
    const siblingsSnapshot = await getDocs(
      query(collection(db, FIT_TESTS_COLLECTION), where('lookupKey', '==', lookupKey))
    );

    const remaining = siblingsSnapshot.docs
      .filter((docSnap) => docSnap.id !== removedFitTestId)
      .map(mapFitTestDoc)
      .filter((record) => !isFitTestPastRetention(record))
      .sort(compareFitTestRecency);

    const next = remaining[0];
    if (!next) return;

    await upsertFitTestLookup(lookupKey, next, next.id, next.userId || fallbackUserId);
  } catch (error) {
    console.error('Error re-pointing fit test lookup:', error);
  }
};

/**
 * Delete fit tests older than 3 years.
 * Testers only clean their own records; admins clean all records.
 * @param {string} userId
 * @returns {Promise<number>} Number of records removed
 */
export const purgeExpiredFitTests = async (userId) => {
  if (!userId) return 0;

  try {
    const role = await getUserRole(userId);
    const testsQuery =
      isAdminOrAbove(role)
        ? collection(db, FIT_TESTS_COLLECTION)
        : query(collection(db, FIT_TESTS_COLLECTION), where('userId', '==', userId));

    const querySnapshot = await getDocs(testsQuery);
    return await deleteExpiredFitTestDocuments(querySnapshot.docs);
  } catch (error) {
    console.error('Error purging expired fit tests:', error);
    return 0;
  }
};

/**
 * Get all fit test records for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of fit test records
 */
export const getUserFitTests = async (userId) => {
  try {
    const q = query(
      collection(db, FIT_TESTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    try {
      await deleteExpiredFitTestDocuments(querySnapshot.docs);
    } catch (cleanupError) {
      console.error('Error purging expired fit tests:', cleanupError);
    }

    const tests = querySnapshot.docs
      .filter((docSnap) => !isFitTestPastRetention(docSnap.data() || {}))
      .map(mapFitTestDoc);

    syncLookupsForFitTests(tests).catch((syncError) => {
      console.error('Error syncing fit test lookups:', syncError);
    });

    return tests;
  } catch (error) {
    console.error('Error fetching fit tests:', error);
    
    // Check if this is a Firebase index error
    // Firebase index errors can have code 'failed-precondition' or message containing 'index'
    const isIndexError = 
      error.code === 'failed-precondition' || 
      error.message?.toLowerCase().includes('index') ||
      error.message?.toLowerCase().includes('query requires an index');
    
    if (isIndexError) {
      // Extract the index creation URL from the error if available
      // Firebase usually includes a URL in the error message
      const indexUrlMatch = error.message?.match(/https:\/\/[^\s\)]+/);
      const indexUrl = indexUrlMatch ? indexUrlMatch[0] : null;
      
      const indexError = new Error('FIREBASE_INDEX_REQUIRED');
      indexError.indexUrl = indexUrl;
      indexError.originalError = error;
      throw indexError;
    }
    
    throw new Error('Failed to fetch fit test records. Please try again.');
  }
};

/**
 * Admin-only: count fit test results grouped by owning userId
 * @param {string} adminUserId
 * @returns {Promise<Record<string, number>>}
 */
export const getFitTestCountsByUser = async (adminUserId) => {
  try {
    await assertAdmin(adminUserId);

    const querySnapshot = await getDocs(collection(db, FIT_TESTS_COLLECTION));
    try {
      await deleteExpiredFitTestDocuments(querySnapshot.docs);
    } catch (cleanupError) {
      console.error('Error purging expired fit tests:', cleanupError);
    }

    const counts = {};
    querySnapshot.docs.forEach((docSnap) => {
      if (isFitTestPastRetention(docSnap.data() || {})) return;
      const ownerId = docSnap.data()?.userId;
      if (!ownerId) return;
      counts[ownerId] = (counts[ownerId] || 0) + 1;
    });

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
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate()?.toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate()?.toISOString(),
      };
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
 * @returns {Promise<{status: 'invalid'|'expired'|'failed'|'valid', card: object|null}>}
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

    const card = toVerifyCardData(verifySnap.data() || {});
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
export const updateFitTest = async (fitTestId, updates, userId) => {
  try {
    // Check if user is admin
    if (!userId) {
      throw new Error('User ID is required to update fit test records.');
    }
    
    const userRole = await getUserRole(userId);
    if (!isAdminOrAbove(userRole)) {
      const error = new Error('Only admin users can edit test results.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }
    
    const docRef = doc(db, FIT_TESTS_COLLECTION, fitTestId);
    const existingSnap = await getDoc(docRef);
    const existing = existingSnap.exists() ? existingSnap.data() : {};
    const nextRecord = { ...existing, ...updates };
    const previousKey = await resolveLookupKey(existing);
    const nextKey = await resolveLookupKey(nextRecord);
    const verificationToken = resolveVerificationToken(nextRecord);
    nextRecord.verificationToken = verificationToken;

    await updateDoc(docRef, {
      ...updates,
      lookupKey: nextKey || null,
      verificationToken,
      updatedAt: Timestamp.now(),
    });

    // Release lookups this record no longer owns, including any older key format.
    const releasedKeys = new Set(
      [previousKey, existing.lookupKey].filter((key) => key && key !== nextKey)
    );
    for (const key of releasedKeys) {
      await deleteFitTestLookupIfCurrent(key, fitTestId);
    }

    if (previousKey && previousKey !== nextKey) {
      // The old name/DOB/email may still belong to other tests for that client.
      await repointLookupToLatestRemaining(previousKey, fitTestId, existing.userId || userId);
    }
    if (nextKey) {
      await upsertFitTestLookup(nextKey, nextRecord, fitTestId, existing.userId || userId);
    }
    await upsertFitTestVerification(
      verificationToken,
      nextRecord,
      fitTestId,
      existing.userId || userId
    );
  } catch (error) {
    console.error('Error updating fit test:', error);
    // Re-throw permission denied errors
    if (error.code === 'PERMISSION_DENIED') {
      throw error;
    }
    throw new Error('Failed to update fit test record. Please try again.');
  }
};

/**
 * Delete a fit test record
 * @param {string} fitTestId - Fit test document ID
 * @param {string} userId - User ID of the user making the delete (for authorization check)
 * @returns {Promise<void>}
 */
export const deleteFitTest = async (fitTestId, userId) => {
  try {
    // Check if user is admin
    if (!userId) {
      throw new Error('User ID is required to delete fit test records.');
    }
    
    const userRole = await getUserRole(userId);
    if (!isAdminOrAbove(userRole)) {
      const error = new Error('Only admin users can delete test results.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }
    
    const docRef = doc(db, FIT_TESTS_COLLECTION, fitTestId);
    const existingSnap = await getDoc(docRef);
    const existing = existingSnap.exists() ? existingSnap.data() : {};
    const lookupKey = await resolveLookupKey(existing);
    await deleteDoc(docRef);

    const staleKeys = new Set([lookupKey, existing.lookupKey].filter(Boolean));
    for (const key of staleKeys) {
      await deleteFitTestLookupIfCurrent(key, fitTestId);
    }

    await deleteFitTestVerification(existing.verificationToken);
    await repointLookupToLatestRemaining(lookupKey, fitTestId, existing.userId || userId);
  } catch (error) {
    console.error('Error deleting fit test:', error);
    // Re-throw permission denied errors
    if (error.code === 'PERMISSION_DENIED') {
      throw error;
    }
    throw new Error('Failed to delete fit test record. Please try again.');
  }
};

/**
 * Get user role from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<string>} User role ('tester', 'admin', or 'superadmin')
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
export const getUserAccessProfile = async (userId) => {
  try {
    if (!userId) {
      return { role: 'tester', status: USER_STATUS_PENDING, schools: [] };
    }

    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return { role: 'tester', status: USER_STATUS_PENDING, schools: [] };
    }

    const data = userDocSnap.data() || {};
    return {
      role: data.role || 'tester',
      status: normalizeUserStatus(data.status),
      schools: normalizeSchoolList(data.schools),
    };
  } catch (error) {
    console.error('Error getting user access profile:', error);
    return { role: 'tester', status: USER_STATUS_PENDING, schools: [] };
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
      docSnaps = await listScopedTesters(schools, [pendingConstraint]);
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
      docSnaps = await listScopedTesters(schools);
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

    if (nextStatus !== current.status) {
      if (nextStatus === USER_STATUS_APPROVED || nextStatus === USER_STATUS_REJECTED) {
        payload.approvedAt = Timestamp.now();
        payload.approvedBy = adminUserId;
      }
    }

    // School tags are super-admin only, and not on the caller's own document.
    if (isSuperAdmin(actorRole) && adminUserId !== targetUserId) {
      if (typeof updates.school === 'string') {
        const nextSchool = updates.school.trim();
        const currentSchool = typeof current.school === 'string' ? current.school : '';
        if (nextSchool !== currentSchool) payload.school = nextSchool;
      }
      if (Array.isArray(updates.schools)) {
        const nextSchools = normalizeSchoolList(updates.schools);
        const currentSchools = normalizeSchoolList(current.schools);
        const sameSchools = nextSchools.length === currentSchools.length
          && nextSchools.every((school, index) => school === currentSchools[index]);
        if (!sameSchools) payload.schools = nextSchools;
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
      if (!USER_STATUSES.includes(data.status)) {
        payload.status = USER_STATUS_PENDING;
      }
      await setDoc(userDocRef, payload, { merge: true });
    } else {
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
 * Backfill expiration dates for existing fit test records
 * Calculates expiration date as issueDate + 1 year for records missing expirationDate
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

