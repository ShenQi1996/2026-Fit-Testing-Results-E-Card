# Firebase Setup Guide

This guide will walk you through setting up Firebase for your Fit Testing Results E-Card application.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter your project name (e.g., "Fit Test Results")
4. (Optional) Enable Google Analytics (you can skip this)
5. Click **"Create project"**
6. Wait for project creation to complete, then click **"Continue"**

## Step 2: Register Your Web App

1. In your Firebase project dashboard, click the **Web icon** (`</>`) or **"Add app"** → **Web**
2. Register your app:
   - App nickname: "Fit Test Web App" (or any name)
   - (Optional) Check "Also set up Firebase Hosting"
   - Click **"Register app"**
3. **Copy the Firebase configuration object** - you'll need this in the next step

## Step 3: Configure Firebase in Your App

1. Open `src/config/firebase.js`
2. Replace the placeholder values with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID", 
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

3. Save the file

## Step 4: Enable Authentication

1. In Firebase Console, go to **Authentication** (left sidebar)
2. Click **"Get started"**
3. Go to the **"Sign-in method"** tab

### Enable Email/Password Authentication
4. Click on **"Email/Password"**
5. Enable **"Email/Password"** (toggle it ON)
6. Click **"Save"**

### Enable Google Authentication (Optional but Recommended)
7. Click on **"Google"**
8. Enable **"Google"** (toggle it ON)
9. Enter a **Project support email** (your email address)
10. Click **"Save"**
11. Google authentication is now enabled! Users can sign in/sign up with their Google accounts.

## Step 5: Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database** (left sidebar)
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development)
   - ⚠️ **Note**: Test mode allows anyone to read/write. For production, set up security rules.
4. Choose a location (select closest to your users)
5. Click **"Enable"**

### Security Rules (Important for Production)

After setup, go to **Rules** tab and update to:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own fit test records
    match /fitTests/{fitTestId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

Click **"Publish"** to save the rules.

## Step 6: Create Firestore Index (Required for Test Results)

When you first try to view test results, Firebase will require a composite index. Here's how to create it:

### Option A: Automatic Creation (Recommended)
1. When you see the error message, click the **"Create Index in Firebase Console"** link
2. This will take you directly to the index creation page
3. Click **"Create Index"**
4. Wait 1-2 minutes for the index to build
5. Refresh the Test Results page

### Option B: Manual Creation
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Firestore Database** → **Indexes** tab
4. Click **"Create Index"**
5. Configure the index:
   - **Collection ID:** `fitTests`
   - **Fields to index:**
     - Field: `userId`, Order: **Ascending**
     - Field: `createdAt`, Order: **Descending**
6. Click **"Create"**
7. Wait 1-2 minutes for the index to build

### Why is this needed?
Firebase requires composite indexes when you query with:
- A `where` clause on one field (`userId`)
- An `orderBy` clause on a different field (`createdAt`)

This is a one-time setup per project.

## Step 7: Install Firebase (Already Done)

Firebase SDK should already be installed. If not, run:
```bash
npm install firebase
```

## Step 8: Test the Integration

1. Start your development server:
```bash
npm start
```

2. Try signing up with a new account
3. Check Firebase Console → Authentication to see the new user
4. Check Firestore Database to see if fit test records are being saved

## Firebase Services Used

### Authentication
- **Email/Password Authentication**: User signup, login, logout
- **User Profile Management**: Update name, email, password
- **Session Management**: Automatic session persistence

### Firestore Database
- **fitTests Collection**: Stores all fit test records
- Each record includes:
  - `userId`: Links record to user
  - Form data (clientName, dob, issueDate, etc.)
  - `createdAt`: Timestamp when created
  - `updatedAt`: Timestamp when last updated

## Data Structure

### User Object (from Firebase Auth)
```javascript
{
  uid: "firebase-user-id",
  email: "user@example.com",
  name: "User Name",
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

### Fit Test Record (in Firestore)
```javascript
{
  userId: "firebase-user-id",
  recipientEmail: "recipient@example.com",
  clientName: "John Doe",
  dob: "01/01/1990",
  issueDate: "12/30/2025",
  fitTestType: "N95",
  respiratorMfg: "3M",
  testingAgent: "Bitrex",
  maskSize: "Regular",
  model: "1870+",
  result: "Pass",
  fitTester: "David Morales",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Benefits of Firebase

✅ **Secure Authentication**: Passwords are hashed and secured by Google
✅ **Automatic Session Management**: Users stay logged in across sessions
✅ **Cloud Database**: Data stored securely in the cloud
✅ **Real-time Updates**: Can add real-time features later
✅ **Scalable**: Handles growth automatically
✅ **Free Tier**: Generous free tier for development

## Free Tier Limits

- **Authentication**: Unlimited users
- **Firestore**: 
  - 1 GB storage
  - 10 GB/month network egress
  - 50K reads/day
  - 20K writes/day
  - 20K deletes/day

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Make sure you've copied the correct config values
- Check that the project ID matches

### "Firebase: Error (auth/email-already-in-use)"
- User already exists - try logging in instead

### "Firebase: Error (auth/invalid-email)"
- Check email format

### "Permission denied" in Firestore
- Check your security rules
- Make sure user is authenticated
- Verify rules allow the operation

### Can't see data in Firestore
- Check that you're looking at the correct collection (`fitTests`)
- Verify security rules allow reading
- Check browser console for errors

## Next Steps

1. ✅ Set up Firebase project
2. ✅ Configure authentication
3. ✅ Set up Firestore
4. ✅ Update firebase.js with your config
5. 🎉 Start using the app!

## Migration from localStorage

The app now uses Firebase instead of localStorage. Your old localStorage data will be ignored. Users will need to:
1. Sign up again (or you can migrate existing users manually)
2. All new fit test records will be stored in Firestore

## Production Considerations

1. **Security Rules**: Update Firestore rules for production
2. **Environment Variables**: Move Firebase config to environment variables
3. **Error Handling**: Add better error handling for network issues
4. **Offline Support**: Consider enabling Firestore offline persistence
5. **Backup**: Set up regular backups of Firestore data

