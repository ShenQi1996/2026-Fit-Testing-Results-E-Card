# Production Setup Guide - Google Sign-In on Vercel

This guide will help you fix Google sign-in issues when deploying to Vercel production.

## Common Issues in Production

1. **Unauthorized Domain Error** - Your Vercel domain is not added to Firebase authorized domains
2. **OAuth Redirect URI Mismatch** - Google OAuth redirect URIs not configured
3. **Popup Blocked** - Browser blocks popup, needs redirect fallback (already implemented)

## Step 1: Add Vercel Domain to Firebase Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **fit-test-result-e-card-2026**
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Click **"Add domain"**
5. Add your Vercel domain(s):
   - `your-project.vercel.app` (your Vercel deployment URL)
   - `your-custom-domain.com` (if you have a custom domain)
   - `localhost` (should already be there for development)
6. Click **"Add"**

**Important**: You need to add the exact domain where your app is hosted. For example:
- If your Vercel URL is `email-form-app.vercel.app`, add that
- If you have a custom domain like `securefit.com`, add that too

## Step 2: Configure Google OAuth in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one if you haven't)
3. Go to **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client ID** (the one used by Firebase)
5. Click to edit it
6. Under **Authorized JavaScript origins**, add:
   - `https://your-project.vercel.app`
   - `https://your-custom-domain.com` (if applicable)
   - `http://localhost:3000` (for development)
7. Under **Authorized redirect URIs**, add:
   - `https://your-project.vercel.app`
   - `https://your-custom-domain.com` (if applicable)
   - `http://localhost:3000` (for development)
   - `https://fit-test-result-e-card-2026.firebaseapp.com/__/auth/handler`
8. Click **"Save"**

## Step 3: Verify Firebase Configuration

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Make sure **Google** is enabled
3. Check that your **Project support email** is set correctly
4. Verify the **Web SDK configuration** shows the correct domains

## Step 4: Environment Variables (Optional but Recommended)

If you want to use environment variables instead of hardcoded config:

1. In Vercel Dashboard, go to your project → **Settings** → **Environment Variables**
2. Add these variables (if you decide to use env vars):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

3. Update `src/config/firebase.js` to use environment variables:
```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

## Step 5: Test in Production

1. Deploy your app to Vercel
2. Visit your production URL
3. Try Google sign-in
4. Check browser console for any errors

## Troubleshooting

### Error: "auth/unauthorized-domain"
**Solution**: Add your Vercel domain to Firebase authorized domains (Step 1)

### Error: "auth/popup-blocked"
**Solution**: The code now automatically falls back to redirect method. This is normal behavior.

### Error: "auth/operation-not-allowed"
**Solution**: Enable Google sign-in in Firebase Console → Authentication → Sign-in method

### Redirect Not Working
**Solution**: 
- Make sure redirect URIs are added in Google Cloud Console (Step 2)
- Clear browser cache and cookies
- Try in incognito/private mode

### Still Not Working?
1. Check browser console for specific error messages
2. Verify all domains are added correctly (no typos)
3. Wait a few minutes after making changes (Google/Firebase can take time to propagate)
4. Try clearing browser cache
5. Check Vercel deployment logs for any build errors

## Quick Checklist

- [ ] Vercel domain added to Firebase authorized domains
- [ ] Google OAuth redirect URIs configured in Google Cloud Console
- [ ] Google sign-in enabled in Firebase Console
- [ ] App deployed to Vercel
- [ ] Tested Google sign-in in production
- [ ] Checked browser console for errors

## Need Help?

If you're still having issues:
1. Check the browser console for specific error codes
2. Check Firebase Console → Authentication → Users (to see if sign-in attempts are being logged)
3. Review Vercel deployment logs
4. Verify all URLs match exactly (including https/http)

---

**Last Updated**: 2024

