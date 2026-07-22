# Firestore Security Rules Setup

## Quick Fix for "Missing or insufficient permissions" Error

If you're getting the error: `FirebaseError: Missing or insufficient permissions`, you need to update your Firestore security rules.

## Steps to Fix:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Firestore Database** → **Rules** tab
4. Replace the existing rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can read/write their own user document
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;

      // Saved solution profiles subcollection
      match /solutionProfiles/{profileId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Fit tests collection - users can only read/write their own fit test records
    match /fitTests/{fitTestId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

5. Click **"Publish"** to save the rules
6. Refresh your app - the error should be resolved

## What These Rules Do:

- **`users` collection**: Allows authenticated users to read and write their own user document (document ID = their UID). This is needed for role management.
- **`users/{userId}/solutionProfiles` subcollection**: Allows authenticated users to create/read/update/delete their own saved solution profiles.
- **`fitTests` collection**: Allows users to read/write only their own fit test records (where `userId` matches their UID).

## Security Notes:

- Users can only access their own data
- All operations require authentication (`request.auth != null`)
- Users cannot access other users' data
- Admin role checks are handled in the application code, not in security rules
