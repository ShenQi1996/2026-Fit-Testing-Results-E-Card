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
import { calculateExpirationDate, isFitTestPastRetention } from '../utils/dateUtils';

const FIRESTORE_BATCH_LIMIT = 400;

const FIT_TESTS_COLLECTION = 'fitTests';
const USERS_COLLECTION = 'users';
const SOLUTION_PROFILES_SUBCOLLECTION = 'solutionProfiles';
const SCHOOL_PROFILES_SUBCOLLECTION = 'schoolProfiles';
export const USER_STATUS_PENDING = 'pending';
export const USER_STATUS_APPROVED = 'approved';
export const USER_STATUS_REJECTED = 'rejected';
export const USER_ROLES = ['tester', 'admin'];
export const USER_STATUSES = [
  USER_STATUS_PENDING,
  USER_STATUS_APPROVED,
  USER_STATUS_REJECTED,
];

const assertAdmin = async (adminUserId) => {
  const adminRole = await getUserRole(adminUserId);
  if (adminRole !== 'admin') {
    const error = new Error('Only admin users can manage users.');
    error.code = 'PERMISSION_DENIED';
    throw error;
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
    status: data.status || USER_STATUS_APPROVED,
    provider: data.provider || 'unknown',
    requestedAt: toIso(data.requestedAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    approvedAt: toIso(data.approvedAt),
    approvedBy: data.approvedBy || null,
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
    const docRef = await addDoc(collection(db, FIT_TESTS_COLLECTION), {
      userId,
      ...fitTestData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
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
    const batch = writeBatch(db);
    expiredDocs.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((docSnap) => {
      batch.delete(docSnap.ref);
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
      role === 'admin'
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

    return querySnapshot.docs
      .filter((docSnap) => !isFitTestPastRetention(docSnap.data() || {}))
      .map(mapFitTestDoc);
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
    if (userRole !== 'admin') {
      const error = new Error('Only admin users can edit test results.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }
    
    const docRef = doc(db, FIT_TESTS_COLLECTION, fitTestId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
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
    if (userRole !== 'admin') {
      const error = new Error('Only admin users can delete test results.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }
    
    const docRef = doc(db, FIT_TESTS_COLLECTION, fitTestId);
    await deleteDoc(docRef);
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
 * @returns {Promise<string>} User role ('admin' or 'tester')
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

    // Backfill common profile fields for existing users without changing approval state.
    await updateDoc(userDocRef, {
      email: userInfo.email || userDocSnap.data().email || '',
      name: userInfo.name || userDocSnap.data().name || '',
      updatedAt: Timestamp.now(),
    });

    return { isNewUser: false };
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    throw new Error('Failed to initialize user profile. Please try again.');
  }
};

/**
 * Get user access profile including role + approval status
 * Missing status defaults to approved for backward compatibility.
 * @param {string} userId - User ID
 * @returns {Promise<{role: string, status: string}>}
 */
export const getUserAccessProfile = async (userId) => {
  try {
    if (!userId) {
      return { role: 'tester', status: USER_STATUS_PENDING };
    }

    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return { role: 'tester', status: USER_STATUS_PENDING };
    }

    const data = userDocSnap.data();
    return {
      role: data.role || 'tester',
      status: data.status || USER_STATUS_APPROVED,
    };
  } catch (error) {
    console.error('Error getting user access profile:', error);
    return { role: 'tester', status: USER_STATUS_PENDING };
  }
};

/**
 * Admin-only: list users waiting for approval
 * @param {string} adminUserId - Current admin user ID
 * @returns {Promise<Array>}
 */
export const getPendingUsers = async (adminUserId) => {
  try {
    await assertAdmin(adminUserId);

    const pendingQuery = query(
      collection(db, USERS_COLLECTION),
      where('status', '==', USER_STATUS_PENDING)
    );
    const querySnapshot = await getDocs(pendingQuery);

    const users = [];
    querySnapshot.forEach((docSnap) => {
      users.push(serializeUserDoc(docSnap));
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
    await assertAdmin(adminUserId);

    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
    const users = [];
    querySnapshot.forEach((docSnap) => {
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
    await assertAdmin(adminUserId);

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
    const nextRole = updates.role || current.role || 'tester';
    const nextStatus = updates.status || current.status || USER_STATUS_APPROVED;

    if (!USER_ROLES.includes(nextRole)) {
      throw new Error('Invalid role. Must be admin or tester.');
    }
    if (!USER_STATUSES.includes(nextStatus)) {
      throw new Error('Invalid status.');
    }

    if (targetUserId === adminUserId && nextRole !== 'admin') {
      throw new Error('You cannot remove your own admin role.');
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
 * Admin-only: delete a user profile document
 * @param {string} adminUserId
 * @param {string} targetUserId
 */
export const deleteManagedUser = async (adminUserId, targetUserId) => {
  try {
    await assertAdmin(adminUserId);

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
    await assertAdmin(adminUserId);

    if (!targetUserId) {
      throw new Error('Target user ID is required.');
    }

    const email = (userData.email || '').trim();
    const name = (userData.name || '').trim();
    const role = userData.role || 'tester';
    const status = userData.status || USER_STATUS_APPROVED;
    const provider = userData.provider || 'password';

    if (!email) {
      throw new Error('Email is required.');
    }
    if (!USER_ROLES.includes(role)) {
      throw new Error('Invalid role. Must be admin or tester.');
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
 * Set user role in Firestore
 * @param {string} userId - User ID
 * @param {string} role - Role to set ('admin' or 'tester')
 * @returns {Promise<void>}
 */
export const setUserRole = async (userId, role) => {
  try {
    if (role !== 'admin' && role !== 'tester') {
      throw new Error('Invalid role. Must be "admin" or "tester".');
    }
    
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      await updateDoc(userDocRef, {
        role,
        updatedAt: Timestamp.now(),
      });
    } else {
      await setDoc(userDocRef, {
        role,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    console.error('Error setting user role:', error);
    throw new Error('Failed to set user role. Please try again.');
  }
};

/**
 * Get all saved solution profiles for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of solution profiles
 */
export const getUserSolutionProfiles = async (userId) => {
  try {
    if (!userId) return [];

    const profilesRef = collection(db, USERS_COLLECTION, userId, SOLUTION_PROFILES_SUBCOLLECTION);
    let querySnapshot;
    try {
      // Preferred ordering from Firestore when available.
      const q = query(profilesRef, orderBy('createdAt', 'desc'));
      querySnapshot = await getDocs(q);
    } catch (queryError) {
      // Fallback to unordered read (then sort in JS) for any query-shape/index issues.
      querySnapshot = await getDocs(profilesRef);
      console.warn('Falling back to unordered solution profile fetch:', queryError);
    }

    const profiles = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      profiles.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
      });
    });

    // Keep explicit order first, then newest-first as fallback.
    profiles.sort((a, b) => {
      const orderA = Number.isInteger(a.orderIndex) ? a.orderIndex : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isInteger(b.orderIndex) ? b.orderIndex : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return profiles;
  } catch (error) {
    console.error('Error fetching solution profiles:', error);
    const message = (error?.message || '').toLowerCase();
    const code = error?.code || '';

    if (code === 'permission-denied' || message.includes('insufficient permissions')) {
      throw new Error('Permission denied for saved solution profiles. Please publish Firestore rules for users/{uid}/solutionProfiles.');
    }

    throw new Error(`Failed to fetch saved solution profiles. ${error?.message || ''}`.trim());
  }
};

/**
 * Save a solution profile for a user
 * @param {string} userId - User ID
 * @param {object} profileData - { solutionType, solutionOpenDate, solutionExpirationDate }
 * @param {boolean} setAsDefault - Whether this profile should be set as default
 * @returns {Promise<string>} Document ID of the saved profile
 */
export const saveUserSolutionProfile = async (userId, profileData, setAsDefault = false) => {
  try {
    if (!userId) {
      throw new Error('User ID is required to save a solution profile.');
    }

    const solutionType = profileData.solutionType?.trim?.() || '';
    const solutionOpenDate = profileData.solutionOpenDate?.trim?.() || '';
    const solutionExpirationDate = profileData.solutionExpirationDate?.trim?.() || '';

    if (!solutionType || !solutionOpenDate || !solutionExpirationDate) {
      throw new Error('Solution type, open date, and expiration date are required.');
    }

    const profilesRef = collection(db, USERS_COLLECTION, userId, SOLUTION_PROFILES_SUBCOLLECTION);
    const profileDocRef = doc(profilesRef);
    const allProfilesSnapshot = await getDocs(profilesRef);
    const nextOrderIndex = allProfilesSnapshot.size;

    if (setAsDefault) {
      const batch = writeBatch(db);
      const defaultsSnapshot = await getDocs(query(profilesRef, where('isDefault', '==', true)));

      defaultsSnapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          isDefault: false,
          updatedAt: Timestamp.now(),
        });
      });

      batch.set(profileDocRef, {
        solutionType,
        solutionOpenDate,
        solutionExpirationDate,
        orderIndex: nextOrderIndex,
        isDefault: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await batch.commit();
    } else {
      await setDoc(profileDocRef, {
        solutionType,
        solutionOpenDate,
        solutionExpirationDate,
        orderIndex: nextOrderIndex,
        isDefault: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    return profileDocRef.id;
  } catch (error) {
    console.error('Error saving solution profile:', error);
    throw new Error(error.message || 'Failed to save solution profile. Please try again.');
  }
};

/**
 * Delete one saved solution profile for a user
 * @param {string} userId - User ID
 * @param {string} profileId - Solution profile ID
 * @returns {Promise<void>}
 */
export const deleteUserSolutionProfile = async (userId, profileId) => {
  try {
    if (!userId || !profileId) {
      throw new Error('User ID and profile ID are required.');
    }

    const profileRef = doc(db, USERS_COLLECTION, userId, SOLUTION_PROFILES_SUBCOLLECTION, profileId);
    await deleteDoc(profileRef);
  } catch (error) {
    console.error('Error deleting solution profile:', error);
    throw new Error('Failed to delete solution profile. Please try again.');
  }
};

/**
 * Persist profile order for a user
 * @param {string} userId - User ID
 * @param {string[]} orderedProfileIds - Profile IDs in desired order (top to bottom)
 * @returns {Promise<void>}
 */
export const reorderUserSolutionProfiles = async (userId, orderedProfileIds) => {
  try {
    if (!userId || !Array.isArray(orderedProfileIds)) {
      throw new Error('User ID and ordered profile IDs are required.');
    }

    const batch = writeBatch(db);
    orderedProfileIds.forEach((profileId, index) => {
      const profileRef = doc(db, USERS_COLLECTION, userId, SOLUTION_PROFILES_SUBCOLLECTION, profileId);
      batch.update(profileRef, {
        orderIndex: index,
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error reordering solution profiles:', error);
    throw new Error('Failed to reorder solution profiles. Please try again.');
  }
};

/**
 * Set one saved solution profile as default for a user
 * @param {string} userId - User ID
 * @param {string} profileId - Solution profile document ID
 * @returns {Promise<void>}
 */
export const setDefaultSolutionProfile = async (userId, profileId) => {
  try {
    if (!userId || !profileId) {
      throw new Error('User ID and profile ID are required.');
    }

    const profilesRef = collection(db, USERS_COLLECTION, userId, SOLUTION_PROFILES_SUBCOLLECTION);
    const snapshot = await getDocs(profilesRef);
    const batch = writeBatch(db);

    snapshot.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        isDefault: docSnap.id === profileId,
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error setting default solution profile:', error);
    throw new Error('Failed to set default solution profile. Please try again.');
  }
};

/**
 * Get all saved school profiles for a user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getUserSchoolProfiles = async (userId) => {
  try {
    if (!userId) return [];

    const profilesRef = collection(db, USERS_COLLECTION, userId, SCHOOL_PROFILES_SUBCOLLECTION);
    let querySnapshot;
    try {
      const q = query(profilesRef, orderBy('createdAt', 'desc'));
      querySnapshot = await getDocs(q);
    } catch (queryError) {
      querySnapshot = await getDocs(profilesRef);
      console.warn('Falling back to unordered school profile fetch:', queryError);
    }

    const profiles = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      profiles.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
      });
    });

    profiles.sort((a, b) => {
      const orderA = Number.isInteger(a.orderIndex) ? a.orderIndex : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isInteger(b.orderIndex) ? b.orderIndex : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return profiles;
  } catch (error) {
    console.error('Error fetching school profiles:', error);
    const message = (error?.message || '').toLowerCase();
    const code = error?.code || '';

    if (code === 'permission-denied' || message.includes('insufficient permissions')) {
      throw new Error('Permission denied for saved school profiles. Please publish Firestore rules for users/{uid}/schoolProfiles.');
    }

    throw new Error(`Failed to fetch saved school profiles. ${error?.message || ''}`.trim());
  }
};

/**
 * Save a school profile for a user
 * @param {string} userId
 * @param {{schoolName: string}} profileData
 * @param {boolean} setAsDefault
 * @returns {Promise<string>}
 */
export const saveUserSchoolProfile = async (userId, profileData, setAsDefault = false) => {
  try {
    if (!userId) {
      throw new Error('User ID is required to save a school profile.');
    }

    const schoolName = profileData.schoolName?.trim?.() || '';
    if (!schoolName) {
      throw new Error('School name is required.');
    }

    const profilesRef = collection(db, USERS_COLLECTION, userId, SCHOOL_PROFILES_SUBCOLLECTION);
    const profileDocRef = doc(profilesRef);
    const allProfilesSnapshot = await getDocs(profilesRef);
    const nextOrderIndex = allProfilesSnapshot.size;

    if (setAsDefault) {
      const batch = writeBatch(db);
      const defaultsSnapshot = await getDocs(query(profilesRef, where('isDefault', '==', true)));

      defaultsSnapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          isDefault: false,
          updatedAt: Timestamp.now(),
        });
      });

      batch.set(profileDocRef, {
        schoolName,
        orderIndex: nextOrderIndex,
        isDefault: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await batch.commit();
    } else {
      await setDoc(profileDocRef, {
        schoolName,
        orderIndex: nextOrderIndex,
        isDefault: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    return profileDocRef.id;
  } catch (error) {
    console.error('Error saving school profile:', error);
    throw new Error(error.message || 'Failed to save school profile. Please try again.');
  }
};

/**
 * Delete one saved school profile for a user
 * @param {string} userId
 * @param {string} profileId
 */
export const deleteUserSchoolProfile = async (userId, profileId) => {
  try {
    if (!userId || !profileId) {
      throw new Error('User ID and profile ID are required.');
    }

    const profileRef = doc(db, USERS_COLLECTION, userId, SCHOOL_PROFILES_SUBCOLLECTION, profileId);
    await deleteDoc(profileRef);
  } catch (error) {
    console.error('Error deleting school profile:', error);
    throw new Error('Failed to delete school profile. Please try again.');
  }
};

/**
 * Set one saved school profile as default for a user
 * @param {string} userId
 * @param {string} profileId
 */
export const setDefaultSchoolProfile = async (userId, profileId) => {
  try {
    if (!userId || !profileId) {
      throw new Error('User ID and profile ID are required.');
    }

    const profilesRef = collection(db, USERS_COLLECTION, userId, SCHOOL_PROFILES_SUBCOLLECTION);
    const snapshot = await getDocs(profilesRef);
    const batch = writeBatch(db);

    snapshot.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        isDefault: docSnap.id === profileId,
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error setting default school profile:', error);
    throw new Error('Failed to set default school profile. Please try again.');
  }
};

/**
 * Persist school profile order for a user
 * @param {string} userId
 * @param {string[]} orderedProfileIds
 */
export const reorderUserSchoolProfiles = async (userId, orderedProfileIds) => {
  try {
    if (!userId || !Array.isArray(orderedProfileIds)) {
      throw new Error('User ID and ordered profile IDs are required.');
    }

    const batch = writeBatch(db);
    orderedProfileIds.forEach((profileId, index) => {
      const profileRef = doc(db, USERS_COLLECTION, userId, SCHOOL_PROFILES_SUBCOLLECTION, profileId);
      batch.update(profileRef, {
        orderIndex: index,
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error reordering school profiles:', error);
    throw new Error('Failed to reorder school profiles. Please try again.');
  }
};

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

