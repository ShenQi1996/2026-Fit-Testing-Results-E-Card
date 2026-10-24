// Firebase Authentication Service
// Handles user authentication using Firebase Auth

import { initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  getAuth,
} from 'firebase/auth';
import { auth, firebaseConfig } from '../config/firebase';
import {
  ensureUserProfile,
  getUserAccessProfile,
  createManagedUserProfile,
  normalizeUserStatus,
} from './firebaseDb';
import {
  isAdminOrAbove,
  isSuperAdmin,
  USER_ROLE_SUPERADMIN,
  USER_ROLE_TESTER,
  USER_ROLES,
} from '../utils/roles';

const PENDING_APPROVAL_MESSAGE = 'Your account is pending admin approval. Please contact an administrator.';
const REJECTED_APPROVAL_MESSAGE = 'Your account request was not approved. Please contact an administrator.';

// Concurrent callers (Google redirect plus the auth-state listener) share one run.
const finalizeInFlight = new Map();

const assertUserApproved = async (user) => {
  const accessProfile = await getUserAccessProfile(user.uid);
  if (accessProfile.status === 'approved') {
    return accessProfile;
  }

  await signOut(auth);
  if (accessProfile.status === 'rejected') {
    throw new Error(REJECTED_APPROVAL_MESSAGE);
  }
  throw new Error(PENDING_APPROVAL_MESSAGE);
};

const toAppUser = (user, accessProfile) => ({
  uid: user.uid,
  email: user.email,
  name: user.displayName || '',
  createdAt: user.metadata?.creationTime,
  role: accessProfile.role,
  status: accessProfile.status,
  school: accessProfile.school || '',
  schools: accessProfile.schools || [],
  startDate: accessProfile.startDate || null,
  endDate: accessProfile.endDate || null,
  programAdministratorName: accessProfile.programAdministratorName || '',
  programAdministratorContact: accessProfile.programAdministratorContact || '',
});

const signOutQuietly = async () => {
  try {
    await signOut(auth);
  } catch (signOutError) {
    console.error('Error signing out after a failed sign-in:', signOutError);
  }
};

const runFinalizeSignIn = async (user, provider) => {
  try {
    await ensureUserProfile({
      uid: user.uid,
      email: user.email,
      name: user.displayName || '',
      provider: provider || 'unknown',
    });
    const accessProfile = await assertUserApproved(user);
    return toAppUser(user, accessProfile);
  } catch (error) {
    // The UI treats a thrown sign-in as logged out. Drop the Auth session too.
    await signOutQuietly();
    throw error;
  }
};

/**
 * Shared tail of every sign-in path. Creates a pending profile when missing,
 * backfills email/name for an existing profile, then signs out unless approved.
 * A backfill that rules reject does not block an already-approved user.
 * @param {object} user Firebase user
 * @param {string} provider
 * @returns {Promise<object>}
 */
export const finalizeSignIn = (user, provider) => {
  const uid = user?.uid;
  if (uid && finalizeInFlight.has(uid)) {
    return finalizeInFlight.get(uid);
  }

  let run;
  run = runFinalizeSignIn(user, provider).finally(() => {
    if (uid && finalizeInFlight.get(uid) === run) {
      finalizeInFlight.delete(uid);
    }
  });
  if (uid) finalizeInFlight.set(uid, run);
  return run;
};

/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} name - User display name
 * @returns {Promise<object>} User object
 */
export const signUp = async (email, password, name) => {
  try {
    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update user profile with display name
    if (name) {
      await updateProfile(user, {
        displayName: name,
      });
    }

    // New accounts are pending, so this creates the profile, signs out, and throws.
    await finalizeSignIn({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || name || '',
      metadata: user.metadata,
    }, 'password');
  } catch (error) {
    if (error?.message === PENDING_APPROVAL_MESSAGE) {
      throw error;
    }
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * Sign in existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} User object
 */
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return await finalizeSignIn(userCredential.user, 'password');
  } catch (error) {
    if (
      error?.message === PENDING_APPROVAL_MESSAGE ||
      error?.message === REJECTED_APPROVAL_MESSAGE
    ) {
      throw error;
    }
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * Sign in with Google
 * Uses popup method first, falls back to redirect if popup is blocked
 * @returns {Promise<object>} User object
 */
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    
    // Add additional scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    
    // Set custom parameters
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      // Try popup method first (works better in most cases)
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      return await finalizeSignIn(
        user,
        user.providerData?.[0]?.providerId || 'google.com'
      );
    } catch (popupError) {
      // Use redirect fallback only when popup is blocked by browser.
      if (popupError.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
        throw new Error('Redirecting to Google sign-in...');
      }
      // If user closes popup, treat as normal cancellation.
      if (popupError.code === 'auth/popup-closed-by-user') {
        throw new Error('Google sign-in was cancelled.');
      }
      // Multiple popup requests should not trigger redirect fallback.
      if (popupError.code === 'auth/cancelled-popup-request') {
        throw new Error('Google sign-in request was cancelled. Please try again.');
      }

      throw popupError;
    }
  } catch (error) {
    // Handle redirect errors or other errors
    if (error.message === 'Redirecting to Google sign-in...') {
      throw error; // Let the redirect happen
    }
    if (
      error?.message === PENDING_APPROVAL_MESSAGE ||
      error?.message === REJECTED_APPROVAL_MESSAGE
    ) {
      throw error;
    }
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * Sign out current user
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error('Failed to sign out. Please try again.');
  }
};

/**
 * Update user profile (name and email)
 * @param {object} user - Current Firebase user object
 * @param {string} name - New display name
 * @param {string} email - New email
 */
export const updateUserProfile = async (user, name, email) => {
  try {
    const updates = {};

    if (name && name !== user.displayName) {
      await updateProfile(user, { displayName: name });
      updates.name = name;
    }

    if (email && email !== user.email) {
      await updateEmail(user, email);
      updates.email = email;
    }

    return updates;
  } catch (error) {
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * Update user password
 * @param {object} user - Current Firebase user object
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password
 */
export const changePassword = async (user, currentPassword, newPassword) => {
  try {
    // Re-authenticate user with current password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPassword);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * Listen to authentication state changes
 * @param {function} callback - Callback function that receives user object or null
 * @returns {function} Unsubscribe function
 */
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const appUser = await finalizeSignIn(
          firebaseUser,
          firebaseUser.providerData?.[0]?.providerId || 'unknown'
        );
        callback(appUser);
      } catch (error) {
        if (
          error?.message !== PENDING_APPROVAL_MESSAGE &&
          error?.message !== REJECTED_APPROVAL_MESSAGE
        ) {
          console.error('Error restoring signed-in user:', error);
        }
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

/**
 * Get current user
 * @returns {Promise<object|null>} Current user object or null
 */
export const getCurrentUser = async () => {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    return await finalizeSignIn(
      user,
      user.providerData?.[0]?.providerId || 'unknown'
    );
  } catch (error) {
    if (
      error?.message !== PENDING_APPROVAL_MESSAGE &&
      error?.message !== REJECTED_APPROVAL_MESSAGE
    ) {
      console.error('Error fetching current user:', error);
    }
    return null;
  }
};

/**
 * Get Firebase auth instance (for use in components)
 * @returns {object} Firebase auth instance
 */
export const getAuthInstance = () => auth;

/**
 * Handle Google sign-in redirect result
 * Call this when your app loads to check if user is returning from Google sign-in redirect
 * @returns {Promise<object|null>} User object if redirect was successful, null otherwise
 */
export const handleGoogleRedirect = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return await finalizeSignIn(
        result.user,
        result.user.providerData?.[0]?.providerId || 'google.com'
      );
    }
    return null;
  } catch (error) {
    if (
      error?.message === PENDING_APPROVAL_MESSAGE ||
      error?.message === REJECTED_APPROVAL_MESSAGE
    ) {
      throw error;
    }
    // No redirect result is normal when the user did not sign in that way.
    return null;
  }
};

/**
 * Admin-only: create Auth user + Firestore profile without changing current admin session.
 * Uses a secondary Firebase app instance.
 * @param {string} adminUserId
 * @param {{email: string, password: string, name?: string, role?: string, status?: string}} userData
 */
export const createManagedAuthUser = async (adminUserId, userData = {}) => {
  let secondaryApp = null;
  try {
    const adminAccess = await getUserAccessProfile(adminUserId);
    if (adminAccess.status !== 'approved' || !isAdminOrAbove(adminAccess)) {
      const error = new Error('Only admin users can create users.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }
    const adminRole = adminAccess.role;
    const requestedRole = userData.role || USER_ROLE_TESTER;
    if (!USER_ROLES.includes(requestedRole)) {
      throw new Error('Invalid role. Must be tester, admin, or superadmin.');
    }
    if (requestedRole === USER_ROLE_SUPERADMIN) {
      const error = new Error('A super admin cannot be created from the client.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }
    if (requestedRole !== USER_ROLE_TESTER && !isSuperAdmin(adminRole)) {
      const error = new Error('Only a super admin can create admin accounts.');
      error.code = 'PERMISSION_DENIED';
      throw error;
    }

    const email = (userData.email || '').trim();
    const password = userData.password || '';
    const name = (userData.name || '').trim();

    if (!email || !password) {
      throw new Error('Email and password are required to create a user.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    // Same firebaseConfig as the primary app: production fallback, or staging env when APP_ENV=staging.
    secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const createdUser = credential.user;

    if (name) {
      await updateProfile(createdUser, { displayName: name });
    }

    const profileInput = {
      email: createdUser.email || email,
      name: name || createdUser.displayName || '',
      role: requestedRole,
      status: normalizeUserStatus(userData.status),
      provider: 'password',
    };
    if (typeof userData.school === 'string' && userData.school.trim()) {
      profileInput.school = userData.school.trim();
    }
    if (Array.isArray(userData.schools) && userData.schools.length) {
      profileInput.schools = userData.schools;
    }
    if (typeof userData.programAdministratorName === 'string') {
      profileInput.programAdministratorName = userData.programAdministratorName;
    }
    if (typeof userData.programAdministratorContact === 'string') {
      profileInput.programAdministratorContact = userData.programAdministratorContact;
    }
    const profile = await createManagedUserProfile(adminUserId, createdUser.uid, profileInput);

    await signOut(secondaryAuth);
    return profile;
  } catch (error) {
    if (error.code === 'PERMISSION_DENIED') throw error;
    if (error?.message && !error.code?.startsWith?.('auth/')) {
      throw error;
    }
    throw new Error(getAuthErrorMessage(error.code) || error.message || 'Failed to create user.');
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch (cleanupError) {
        console.warn('Failed to clean up secondary Firebase app:', cleanupError);
      }
    }
  }
};

/**
 * Convert Firebase error codes to user-friendly messages
 * @param {string} errorCode - Firebase error code
 * @returns {string} User-friendly error message
 */
export const getAuthErrorMessage = (errorCode) => {
  const errorMessages = {
    'auth/email-already-in-use': 'This email is already registered. Please use a different email or try logging in.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'Email/password accounts are not enabled. Please contact support.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/requires-recent-login': 'Please log out and log back in to change your email or password.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request': 'Only one popup request is allowed at a time.',
    'auth/popup-blocked': 'Popup was blocked by your browser. The page will redirect to Google sign-in instead.',
    'auth/unauthorized-domain': 'This domain is not authorized for OAuth operations. Please add your domain to Firebase authorized domains.',
  };

  return errorMessages[errorCode] || 'An error occurred. Please try again.';
};

