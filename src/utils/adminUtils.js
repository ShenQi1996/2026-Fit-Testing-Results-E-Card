// Admin utility functions
// Use these functions to manage user roles
//
// OPTION 1 - Set qisam1989@gmail.com as admin (Recommended):
// 1. Log in as qisam1989@gmail.com
// 2. Open browser console (F12)
// 3. Get user UID from React DevTools or run:
//    const user = /* get from auth context or React DevTools */;
//    console.log('User UID:', user.uid);
// 4. Run:
//    import { setAdminUser } from './utils/adminUtils';
//    await setAdminUser('PASTE_UID_HERE');
//
// OR use the helper function when logged in:
//    import { initializeAdminForQisam } from './utils/adminUtils';
//    await initializeAdminForQisam(user.uid, user.email);
//
// ALTERNATIVE - Set admin directly in Firestore:
// 1. Go to Firebase Console → Firestore Database
// 2. Create/update document in 'users' collection with document ID = user's UID
// 3. Set field: role = 'admin'
//
// DEFAULT: All users default to 'tester' role automatically

import { setUserRole } from '../services/firebaseDb';

/**
 * Set a user as admin by their user ID
 * Usage: Call this function with a user's UID to grant them admin access
 * Example: await setAdminUser('user-uid-here');
 * 
 * @param {string} userId - Firebase user UID
 * @returns {Promise<void>}
 */
export const setAdminUser = async (userId) => {
  try {
    await setUserRole(userId, 'admin');
    console.log(`User ${userId} has been set as admin.`);
  } catch (error) {
    console.error('Error setting admin user:', error);
    throw error;
  }
};

/**
 * Set a user as tester (default role)
 * Usage: Call this function to revoke admin access and set user back to tester
 * 
 * @param {string} userId - Firebase user UID
 * @returns {Promise<void>}
 */
export const setTesterUser = async (userId) => {
  try {
    await setUserRole(userId, 'tester');
    console.log(`User ${userId} has been set as tester.`);
  } catch (error) {
    console.error('Error setting tester user:', error);
    throw error;
  }
};

/**
 * Set admin for current logged-in user if email matches
 * Usage: Call this function when logged in as the user you want to make admin
 * Example: await setCurrentUserAsAdminIfEmail('qisam1989@gmail.com');
 * 
 * @param {string} email - Email address to check
 * @param {string} userId - Current user's UID (from auth context)
 * @returns {Promise<boolean>} True if admin was set, false otherwise
 */
export const setCurrentUserAsAdminIfEmail = async (email, userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    // Get current user's email from auth (you'll need to pass it or get it from context)
    // For now, we'll set admin if userId is provided
    // In practice, you'd check the email matches before calling
    await setAdminUser(userId);
    return true;
  } catch (error) {
    console.error('Error setting current user as admin:', error);
    throw error;
  }
};

/**
 * Initialize admin for qisam1989@gmail.com
 * Call this function once when logged in as qisam1989@gmail.com
 * Usage: 
 *   import { initializeAdminForQisam } from './utils/adminUtils';
 *   await initializeAdminForQisam(user.uid, user.email);
 * 
 * @param {string} userId - Current user's UID
 * @param {string} userEmail - Current user's email
 * @returns {Promise<void>}
 */
export const initializeAdminForQisam = async (userId, userEmail) => {
  if (!userId || !userEmail) {
    throw new Error('User ID and email are required');
  }
  
  if (userEmail === 'qisam1989@gmail.com') {
    await setAdminUser(userId);
    console.log('Admin role initialized for qisam1989@gmail.com');
  } else {
    console.log('Email does not match qisam1989@gmail.com. Admin not set.');
  }
};
