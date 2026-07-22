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
import { calculateExpirationDate } from '../utils/dateUtils';

const FIT_TESTS_COLLECTION = 'fitTests';
const USERS_COLLECTION = 'users';
const SOLUTION_PROFILES_SUBCOLLECTION = 'solutionProfiles';

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
    const fitTests = [];
    
    querySnapshot.forEach((doc) => {
      fitTests.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()?.toISOString(),
        updatedAt: doc.data().updatedAt?.toDate()?.toISOString(),
      });
    });
    
    return fitTests;
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
    } else {
      // User doesn't exist in users collection, create with default role
      await setDoc(userDocRef, {
        role: 'tester',
        createdAt: Timestamp.now(),
      });
      return 'tester';
    }
  } catch (error) {
    console.error('Error getting user role:', error);
    // Default to tester on error
    return 'tester';
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

