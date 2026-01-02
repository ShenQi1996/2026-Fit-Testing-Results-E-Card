// Firebase Configuration
// Replace these values with your Firebase project credentials
// Get them from: https://console.firebase.google.com/

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// TODO: Replace with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyDb-yI2sKaNHNUWLVAL6begbfYajW0dXIQ",
  authDomain: "fit-test-result-e-card-2026.firebaseapp.com",
  projectId: "fit-test-result-e-card-2026",
  storageBucket: "fit-test-result-e-card-2026.firebasestorage.app",
  messagingSenderId: "150291492122",
  appId: "1:150291492122:web:1d0c66527cba20ae5210a3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

