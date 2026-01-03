import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  signUp,
  signIn,
  signInWithGoogle as firebaseSignInWithGoogle,
  logout as firebaseLogout,
  updateUserProfile,
  changePassword,
  onAuthStateChange,
  getCurrentUser,
  getAuthInstance,
  handleGoogleRedirect,
} from '../services/firebaseAuth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Current logged-in user (null if not logged in)
  const [user, setUser] = useState(null);
  // Loading state while checking for existing session
  const [loading, setLoading] = useState(true);

  // STEP 1: On app load, check if user is already logged in
  // Firebase automatically handles session persistence
  useEffect(() => {
    // Check for Google redirect result first (if user is returning from Google sign-in)
    const checkRedirect = async () => {
      try {
        await handleGoogleRedirect();
        // If redirect was successful, onAuthStateChange will update the user
      } catch (error) {
        // No redirect or redirect failed, continue normally
        console.log('No Google redirect detected');
      }
    };
    
    checkRedirect();

    // Listen to authentication state changes
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // STEP 2: User Registration (Signup)
  // Creates a new user account in Firebase and automatically logs them in
  const signup = async (userData) => {
    try {
      const newUser = await signUp(userData.email, userData.password, userData.name);
      // User state will be updated automatically by onAuthStateChange listener
      return newUser;
    } catch (error) {
      throw error;
    }
  };

  // STEP 3: User Login
  // Verifies credentials with Firebase and creates a session
  const login = async (email, password) => {
    try {
      const user = await signIn(email, password);
      // User state will be updated automatically by onAuthStateChange listener
      return user;
    } catch (error) {
      throw error;
    }
  };

  // STEP 3.5: Google Sign-In
  // Signs in or signs up user with Google account
  const loginWithGoogle = async () => {
    try {
      const user = await firebaseSignInWithGoogle();
      // User state will be updated automatically by onAuthStateChange listener
      return user;
    } catch (error) {
      throw error;
    }
  };

  // STEP 4: User Logout
  // Signs out from Firebase and clears user state
  const logout = async () => {
    try {
      await firebaseLogout();
      // User state will be cleared automatically by onAuthStateChange listener
    } catch (error) {
      throw error;
    }
  };

  // STEP 5: Update User Account
  // Allows users to update their name, email, and/or password using Firebase
  const updateUser = async (updateData) => {
    try {
      const currentFirebaseUser = getCurrentUser();
      if (!currentFirebaseUser || !user) {
        throw new Error('No user logged in');
      }

      // Get the actual Firebase user object
      const auth = getAuthInstance();
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error('No user logged in');
      }

      // Update profile (name and/or email)
      if (updateData.name || updateData.email) {
        await updateUserProfile(
          firebaseUser,
          updateData.name || user.name,
          updateData.email || user.email
        );
      }

      // Update password if provided
      if (updateData.newPassword) {
        if (!updateData.currentPassword) {
          throw new Error('Current password is required to change password');
        }
        await changePassword(firebaseUser, updateData.currentPassword, updateData.newPassword);
      }

      // Get updated user info
      const updatedUser = getCurrentUser();
      if (updatedUser) {
        setUser(updatedUser);
      }

      return updatedUser;
    } catch (error) {
      throw error;
    }
  };

  // Provide these values and functions to all child components
  const value = {
    user,                    // Current user object (or null)
    signup,                  // Function to register new user
    login,                   // Function to log in
    loginWithGoogle,         // Function to log in with Google
    logout,                  // Function to log out
    updateUser,              // Function to update account info
    loading,                 // Boolean: checking for session
    isAuthenticated: !!user, // Boolean: true if user is logged in
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
