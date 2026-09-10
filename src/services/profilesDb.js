import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const USERS_COLLECTION = 'users';
export const SOLUTION_PROFILES_SUBCOLLECTION = 'solutionProfiles';
export const SCHOOL_PROFILES_SUBCOLLECTION = 'schoolProfiles';

const sortProfiles = (profiles) => {
  profiles.sort((a, b) => {
    const orderA = Number.isInteger(a.orderIndex) ? a.orderIndex : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isInteger(b.orderIndex) ? b.orderIndex : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
  return profiles;
};

const createUserProfileStore = ({
  subcollection,
  noun,
  plural,
  toPayload,
}) => {
  const getProfilesRef = (userId) => collection(db, USERS_COLLECTION, userId, subcollection);

  const getAll = async (userId) => {
    try {
      if (!userId) return [];

      const profilesRef = getProfilesRef(userId);
      let querySnapshot;
      try {
        const q = query(profilesRef, orderBy('createdAt', 'desc'));
        querySnapshot = await getDocs(q);
      } catch (queryError) {
        querySnapshot = await getDocs(profilesRef);
        console.warn(`Falling back to unordered ${noun} fetch:`, queryError);
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

      return sortProfiles(profiles);
    } catch (error) {
      console.error(`Error fetching ${plural}:`, error);
      const message = (error?.message || '').toLowerCase();
      const code = error?.code || '';

      if (code === 'permission-denied' || message.includes('insufficient permissions')) {
        throw new Error(
          `Permission denied for saved ${plural}. Please publish Firestore rules for users/{uid}/${subcollection}.`
        );
      }

      throw new Error(`Failed to fetch saved ${plural}. ${error?.message || ''}`.trim());
    }
  };

  const save = async (userId, profileData, setAsDefault = false) => {
    try {
      if (!userId) {
        throw new Error(`User ID is required to save a ${noun}.`);
      }

      const payload = toPayload(profileData);
      const profilesRef = getProfilesRef(userId);
      const profileDocRef = doc(profilesRef);
      const allProfilesSnapshot = await getDocs(profilesRef);
      const nextOrderIndex = allProfilesSnapshot.size;
      const record = {
        ...payload,
        orderIndex: nextOrderIndex,
        isDefault: Boolean(setAsDefault),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (setAsDefault) {
        const batch = writeBatch(db);
        const defaultsSnapshot = await getDocs(query(profilesRef, where('isDefault', '==', true)));

        defaultsSnapshot.forEach((docSnap) => {
          batch.update(docSnap.ref, {
            isDefault: false,
            updatedAt: Timestamp.now(),
          });
        });

        batch.set(profileDocRef, record);
        await batch.commit();
      } else {
        await setDoc(profileDocRef, record);
      }

      return profileDocRef.id;
    } catch (error) {
      console.error(`Error saving ${noun}:`, error);
      throw new Error(error.message || `Failed to save ${noun}. Please try again.`);
    }
  };

  const remove = async (userId, profileId) => {
    try {
      if (!userId || !profileId) {
        throw new Error('User ID and profile ID are required.');
      }

      await deleteDoc(doc(db, USERS_COLLECTION, userId, subcollection, profileId));
    } catch (error) {
      console.error(`Error deleting ${noun}:`, error);
      throw new Error(`Failed to delete ${noun}. Please try again.`);
    }
  };

  const reorder = async (userId, orderedProfileIds) => {
    try {
      if (!userId || !Array.isArray(orderedProfileIds)) {
        throw new Error('User ID and ordered profile IDs are required.');
      }

      const batch = writeBatch(db);
      orderedProfileIds.forEach((profileId, index) => {
        const profileRef = doc(db, USERS_COLLECTION, userId, subcollection, profileId);
        batch.update(profileRef, {
          orderIndex: index,
          updatedAt: Timestamp.now(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error(`Error reordering ${plural}:`, error);
      throw new Error(`Failed to reorder ${plural}. Please try again.`);
    }
  };

  const setDefault = async (userId, profileId) => {
    try {
      if (!userId || !profileId) {
        throw new Error('User ID and profile ID are required.');
      }

      const snapshot = await getDocs(getProfilesRef(userId));
      const batch = writeBatch(db);

      snapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          isDefault: docSnap.id === profileId,
          updatedAt: Timestamp.now(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error(`Error setting default ${noun}:`, error);
      throw new Error(`Failed to set default ${noun}. Please try again.`);
    }
  };

  return { getAll, save, remove, reorder, setDefault };
};

const solutionProfiles = createUserProfileStore({
  subcollection: SOLUTION_PROFILES_SUBCOLLECTION,
  noun: 'solution profile',
  plural: 'solution profiles',
  toPayload: (profileData) => {
    const solutionType = profileData.solutionType?.trim?.() || '';
    const solutionOpenDate = profileData.solutionOpenDate?.trim?.() || '';
    const solutionExpirationDate = profileData.solutionExpirationDate?.trim?.() || '';

    if (!solutionType || !solutionOpenDate || !solutionExpirationDate) {
      throw new Error('Solution type, open date, and expiration date are required.');
    }

    return { solutionType, solutionOpenDate, solutionExpirationDate };
  },
});

const schoolProfiles = createUserProfileStore({
  subcollection: SCHOOL_PROFILES_SUBCOLLECTION,
  noun: 'school profile',
  plural: 'school profiles',
  toPayload: (profileData) => {
    const schoolName = profileData.schoolName?.trim?.() || '';
    if (!schoolName) {
      throw new Error('School name is required.');
    }
    return { schoolName };
  },
});

export const getUserSolutionProfiles = (userId) => solutionProfiles.getAll(userId);
export const saveUserSolutionProfile = (userId, profileData, setAsDefault = false) =>
  solutionProfiles.save(userId, profileData, setAsDefault);
export const deleteUserSolutionProfile = (userId, profileId) =>
  solutionProfiles.remove(userId, profileId);
export const reorderUserSolutionProfiles = (userId, orderedProfileIds) =>
  solutionProfiles.reorder(userId, orderedProfileIds);
export const setDefaultSolutionProfile = (userId, profileId) =>
  solutionProfiles.setDefault(userId, profileId);

export const getUserSchoolProfiles = (userId) => schoolProfiles.getAll(userId);
export const saveUserSchoolProfile = (userId, profileData, setAsDefault = false) =>
  schoolProfiles.save(userId, profileData, setAsDefault);
export const deleteUserSchoolProfile = (userId, profileId) =>
  schoolProfiles.remove(userId, profileId);
export const reorderUserSchoolProfiles = (userId, orderedProfileIds) =>
  schoolProfiles.reorder(userId, orderedProfileIds);
export const setDefaultSchoolProfile = (userId, profileId) =>
  schoolProfiles.setDefault(userId, profileId);
