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

### Security Rules (required for production, verify, and resend)

Do not leave Firestore in test mode. Open **Rules** and publish the file in this repo:

[`firestore.rules`](./firestore.rules)

See [FIRESTORE_RULES_SETUP.md](./FIRESTORE_RULES_SETUP.md). Those rules include public **get** (not list) for `fitTestVerifications` and `fitTestLookups`. Without them, `/verify` and `/resend` fail.

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

1. Start the development server (`nvm use 24` first):
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) (home) or [http://localhost:3000/staff_login](http://localhost:3000/staff_login) (staff). Do not use `npm start dev`.

2. New testers stay **pending** until an admin approves them. They cannot send records until then.
3. Check Firebase Console → Authentication and Firestore (`users`, `fitTests`).

## Firebase Services Used

### Authentication
- **Email/Password Authentication**: User signup, login, logout
- **User Profile Management**: Update name, email, password
- **Session Management**: Automatic session persistence

### Firestore Database
- **`users`**: name, email, `role` (`tester` / `admin`), `status` (`pending` / `approved`)
- **`fitTests`**: form fields, signatures, consent, `verificationToken`, `expirationDate`, `userId`
- **`fitTestVerifications/{token}`**: public verify lookup
- **`fitTestLookups/{lookupKey}`**: public resend lookup
- **`users/{uid}/solutionProfiles`** and **`schoolProfiles`**: saved defaults

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
Includes form fields plus:
- `userId`, `createdAt`, `updatedAt`
- `verificationToken` (32 hex characters; QR uses `/verify/{token}`)
- `expirationDate` (issue date + 1 year)
- Consent flags and tester Yes/No (`testerMedicalRestrictionsReceived`)
- Signature data URLs

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
- Publish [`firestore.rules`](./firestore.rules) — see [FIRESTORE_RULES_SETUP.md](./FIRESTORE_RULES_SETUP.md)
- Confirm the tester is signed in and **approved**
- Public pages only work with a known verify token or resend lookup key

### Can't see data in Firestore
- Check that you're looking at the correct collection (`fitTests`)
- Verify security rules allow reading — publish [`firestore.rules`](./firestore.rules)
- Check browser console for errors

## Production

1. Publish [`firestore.rules`](./firestore.rules)
2. Add the production hostname to Firebase authorized domains (see [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md))
3. Keep EmailJS and Firebase keys out of public issues; they currently live in client files

