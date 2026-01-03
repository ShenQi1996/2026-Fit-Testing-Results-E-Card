// Firebase Authentication Service
// Handles user authentication using Firebase Auth

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
} from 'firebase/auth';
import { auth } from '../config/firebase';

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

    return {
      uid: user.uid,
      email: user.email,
      name: user.displayName || name,
      createdAt: user.metadata.creationTime,
    };
  } catch (error) {
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
    const user = userCredential.user;

    return {
      uid: user.uid,
      email: user.email,
      name: user.displayName || '',
      createdAt: user.metadata.creationTime,
    };
  } catch (error) {
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

      return {
        uid: user.uid,
        email: user.email,
        name: user.displayName || '',
        createdAt: user.metadata.creationTime,
      };
    } catch (popupError) {
      // If popup is blocked or fails, check if we should use redirect
      if (
        popupError.code === 'auth/popup-blocked' ||
        popupError.code === 'auth/popup-closed-by-user' ||
        popupError.code === 'auth/cancelled-popup-request'
      ) {
        // Use redirect method as fallback
        // Note: This will cause a full page redirect
        await signInWithRedirect(auth, provider);
        // The function will return after redirect, so we throw a special error
        // The actual sign-in will complete after the redirect
        throw new Error('Redirecting to Google sign-in...');
      }
      // Re-throw other errors
      throw popupError;
    }
  } catch (error) {
    // Handle redirect errors or other errors
    if (error.message === 'Redirecting to Google sign-in...') {
      throw error; // Let the redirect happen
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
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || '',
        createdAt: firebaseUser.metadata.creationTime,
      });
    } else {
      callback(null);
    }
  });
};

/**
 * Get current user
 * @returns {object|null} Current user object or null
 */
export const getCurrentUser = () => {
  const user = auth.currentUser;
  if (user) {
    return {
      uid: user.uid,
      email: user.email,
      name: user.displayName || '',
      createdAt: user.metadata.creationTime,
    };
  }
  return null;
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
      return {
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.displayName || '',
        createdAt: result.user.metadata.creationTime,
      };
    }
    return null;
  } catch (error) {
    // If there's an error, it means no redirect happened or it failed
    // This is normal if user didn't use redirect method
    return null;
  }
};

/**
 * Convert Firebase error codes to user-friendly messages
 * @param {string} errorCode - Firebase error code
 * @returns {string} User-friendly error message
 */
const getAuthErrorMessage = (errorCode) => {
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
    'auth/operation-not-allowed': 'Google sign-in is not enabled. Please enable it in Firebase Console.',
  };

  return errorMessages[errorCode] || 'An error occurred. Please try again.';
};

