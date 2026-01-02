# User System Guide

This document explains how the user authentication and account management system works in the Fit Testing Results E-Card application.

## Overview

The application uses **Firebase Authentication** for secure user authentication and **Firebase Firestore** for data storage. This provides enterprise-grade security and scalability suitable for both development and production use.

## Architecture

### Components Structure

```
src/
├── context/
│   └── AuthContext.js          # Central user state management
├── components/
│   ├── Login.js                # Login page
│   ├── Signup.js               # Registration page
│   ├── EditAccount.js          # Account editing page
│   ├── Header.js               # Navigation header
│   └── EmailForm.js            # Main form (protected)
└── App.js                      # Main app with routing logic
```

## How It Works

### 1. User Registration (Signup)

**Flow:**
1. User fills out signup form (name, email, password, confirm password)
2. Firebase checks if email already exists
3. If new, creates user account in Firebase Authentication
4. Stores additional user profile data in Firestore
5. Automatically logs user in

**Storage:**
- User authentication handled by Firebase Authentication
- User profile data stored in Firestore `users` collection
- Session managed automatically by Firebase

**User Object Structure:**
```javascript
{
  uid: "firebase-generated-id",   // Unique Firebase user ID
  email: "john@example.com",      // User's email
  displayName: "John Doe",        // User's full name
  createdAt: Timestamp            // Account creation timestamp
}
```

### 2. User Login

**Flow:**
1. User enters email and password
2. Firebase Authentication verifies credentials
3. If valid, Firebase creates secure session
4. User profile data is fetched from Firestore
5. User is redirected to main form

**Authentication Check:**
- Firebase securely verifies email and password (hashed)
- If valid → login successful, session created
- If invalid → shows error message
- Supports Google Sign-In as alternative

### 3. User Session Management

**How Sessions Work:**
- Firebase Authentication manages sessions automatically
- Session persists across page refreshes and browser restarts
- On app load, Firebase checks for existing authenticated session
- If valid session found → user stays logged in
- If no session → user sees login page

**Session Data:**
- Managed by Firebase Authentication
- Includes user ID, email, and authentication token
- User profile data fetched from Firestore when needed
- No password stored (Firebase handles this securely)

### 4. Protected Routes

**How Protection Works:**
- App.js checks `isAuthenticated` from AuthContext
- If `false` → shows Login/Signup page
- If `true` → shows EmailForm (main application)

**Code Flow:**
```javascript
if (!isAuthenticated) {
  return <Login />  // Show login page
}
return <EmailForm />  // Show main app
```

### 5. Account Editing

**Flow:**
1. User clicks "Edit Account" in header
2. EditAccount component loads with current user data from Firestore
3. User can update:
   - Name (displayName)
   - Email
   - Password (optional, requires current password)
4. On submit, system:
   - Validates current password with Firebase (if changing password)
   - Checks email uniqueness with Firebase (if changing email)
   - Updates user profile in Firestore
   - Updates Firebase Authentication if email/password changed
   - Refreshes user session data

### 6. Logout

**Flow:**
1. User clicks "Logout" button
2. Firebase Authentication signs out the user
3. Clears user state in AuthContext
4. User is redirected to login/landing page

## Data Storage

### Firebase Authentication

- **User Accounts**: Stored securely in Firebase Authentication
- **Passwords**: Hashed and secured by Firebase (never stored in plain text)
- **Sessions**: Managed automatically by Firebase

### Firestore Database

1. **`users` Collection** (User Profiles)
   - Stores additional user profile data
   - Format: `{ uid, name, email, createdAt }`
   - Linked to Firebase Authentication by `uid`

2. **`fitTests` Collection** (Fit Test Records)
   - Stores all fit test records
   - Each record linked to user via `userId`
   - Format: `{ userId, clientName, dob, issueDate, ... }`

### Example Firestore Data

```javascript
// users collection
{
  uid: "firebase-user-id-123",
  name: "John Doe",
  email: "john@example.com",
  createdAt: Timestamp
}

// fitTests collection
{
  userId: "firebase-user-id-123",
  recipientEmail: "client@example.com",
  clientName: "Jane Smith",
  dob: "01/01/1990",
  issueDate: "12/30/2025",
  fitTestType: "N95",
  respiratorMfg: "3M",
  testingAgent: "Bitrex",
  maskSize: "Regular",
  model: "1870+",
  result: "Pass",
  fitTester: "John Doe",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## AuthContext API

The `AuthContext` provides these functions and values:

### Values
- `user` - Current user object (or null if not logged in)
- `loading` - Boolean indicating if auth check is in progress
- `isAuthenticated` - Boolean indicating if user is logged in

### Functions
- `signup(userData)` - Register a new user (Firebase Authentication)
- `login(email, password)` - Log in existing user (Firebase Authentication)
- `loginWithGoogle()` - Sign in with Google account
- `logout()` - Log out current user (Firebase Authentication)
- `updateUser(updateData)` - Update user information (Firestore)

### Usage Example

```javascript
import { useAuth } from './context/AuthContext';

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  
  // Access user data
  console.log(user.name);  // "John Doe"
  
  // Check if logged in
  if (isAuthenticated) {
    // Show protected content
  }
  
  // Login
  await login('john@example.com', 'password123');
  
  // Logout
  logout();
}
```

## User Flow Diagrams

### Registration Flow
```
User visits app
  ↓
Sees Login page
  ↓
Clicks "Sign up"
  ↓
Fills signup form
  ↓
System validates:
  - Email not already used
  - Password matches confirmation
  - Password length >= 6
  ↓
Creates user account
  ↓
Stores in localStorage
  ↓
Auto-login
  ↓
Redirects to main form
```

### Login Flow
```
User visits app
  ↓
Sees Login page
  ↓
Enters email & password
  ↓
System searches fitTestUsers
  ↓
Finds match?
  ├─ Yes → Create session → Show main form
  └─ No → Show error message
```

### Session Persistence Flow
```
User closes browser
  ↓
User returns later
  ↓
App loads
  ↓
Checks localStorage for 'fitTestUser'
  ↓
Found?
  ├─ Yes → Restore session → Show main form
  └─ No → Show login page
```

## Security Considerations

### Current Implementation (Production-Ready)
- ✅ Passwords hashed and secured by Firebase
- ✅ All data stored securely in Firebase cloud
- ✅ Server-side validation via Firebase
- ✅ Encrypted connections (HTTPS required)
- ✅ Secure session management by Firebase
- ✅ User-specific data access via Firestore security rules

### Additional Security Features
1. **Firestore Security Rules**: Users can only access their own data
2. **Firebase Authentication**: Industry-standard authentication
3. **HTTPS**: All connections encrypted
4. **Token-Based Auth**: Firebase uses secure tokens
5. **Input Validation**: Client and server-side validation
6. **Rate Limiting**: Built into Firebase Authentication

## Troubleshooting

### User Can't Login
- Check if user exists in Firebase Authentication console
- Verify email and password are correct
- Check browser console for Firebase errors
- Try password reset if needed

### Session Not Persisting
- Check Firebase Authentication status in console
- Verify Firebase configuration is correct
- Check browser console for authentication errors
- Clear browser cache and try again

### Can't Update Account
- Verify current password is correct (if changing password)
- Check if new email is already in use
- Ensure all required fields are filled

## Testing the System

### Manual Testing Steps

1. **Test Signup:**
   - Go to app
   - Click "Sign up"
   - Fill form and submit
   - Should auto-login and show form

2. **Test Login:**
   - Logout
   - Enter credentials
   - Should login and show form

3. **Test Session Persistence:**
   - Login
   - Refresh page
   - Should stay logged in

4. **Test Edit Account:**
   - Click "Edit Account"
   - Update name/email
   - Should save and update header

5. **Test Password Change:**
   - Go to Edit Account
   - Enter current password
   - Enter new password
   - Should update successfully

## Future Enhancements

Possible improvements to consider:
- [x] Password reset functionality (Firebase supports this)
- [x] Email verification (Firebase supports this)
- [x] Social login (Google Sign-In implemented)
- [ ] User profile pictures
- [ ] Account deletion
- [ ] Two-factor authentication
- [ ] User roles and permissions
- [ ] Activity history/logs
- [ ] Email notifications
- [ ] Multi-factor authentication

