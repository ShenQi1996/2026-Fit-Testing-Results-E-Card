# How to Run the Fit Testing Results E-Card Application

This guide provides step-by-step instructions for setting up and running the application on your local machine.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14.0.0 or higher)
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
- **npm** (comes with Node.js)
  - Verify installation: `npm --version`
- **Git** (optional, for cloning)
  - Download from [git-scm.com](https://git-scm.com/)

## 🚀 Step-by-Step Setup

### Step 1: Install Dependencies

Navigate to the project directory and install all required packages:

```bash
cd email-form-app
npm install
```

This will install all dependencies listed in `package.json`, including:
- React and React DOM
- Firebase SDK
- EmailJS browser SDK
- Webpack and build tools
- Babel and transpilers

**Expected time**: 2-5 minutes depending on your internet connection.

### Step 2: Configure Firebase

The application requires Firebase for authentication and database storage.

#### 2.1 Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter project name (e.g., "fit-testing-app")
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

#### 2.2 Enable Authentication

1. In Firebase Console, go to **Authentication** → **Get started**
2. Click on **Sign-in method** tab
3. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable" to ON
   - Click "Save"
4. Enable **Google** (optional but recommended):
   - Click on "Google"
   - Toggle "Enable" to ON
   - Enter project support email
   - Click "Save"

#### 2.3 Create Firestore Database

1. In Firebase Console, go to **Firestore Database** → **Create database**
2. Choose **Start in test mode** (for development)
3. Select a location for your database
4. Click "Enable"

#### 2.4 Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click the web icon (</>) to add a web app
4. Register your app (give it a nickname)
5. Copy the Firebase configuration object

#### 2.5 Update Firebase Config File

Open `src/config/firebase.js` and replace the placeholder values:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

Replace all `YOUR_*` values with your actual Firebase config values.

#### 2.6 Create Firestore Index (Required)

1. Navigate to the "Test Results" page in the app (after logging in)
2. If you see an error about a missing index, click the link provided
3. Or manually create the index:
   - Go to Firestore → Indexes
   - Click "Create Index"
   - Collection: `fitTests`
   - Fields:
     - `userId` (Ascending)
     - `createdAt` (Descending)
   - Click "Create"

For detailed Firebase setup, see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

### Step 3: Configure EmailJS (Optional)

EmailJS is used to send e-cards via email. This step is optional if you only want to test the database functionality.

#### 3.1 Create EmailJS Account

1. Go to [EmailJS](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

#### 3.2 Create Email Service

1. In EmailJS dashboard, go to **Email Services**
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the connection instructions
5. Note your **Service ID**

#### 3.3 Create Email Template

1. Go to **Email Templates** → **Create New Template**
2. Set up your template:
   - **To Email**: `{{to_email}}`
   - **Subject**: `{{subject}}` or "Fit Testing Results E-card"
   - **Content**: `{{html_message}}`
3. **Important**: Set the format to **HTML**
   - Look for "Edit Content" button or "Settings" tab
   - Change content type to HTML
4. Note your **Template ID**

#### 3.4 Get Public Key

1. Go to **Account** → **General**
2. Copy your **Public Key**

#### 3.5 Update EmailJS Config

Open `src/services/emailService.js` and update:

```javascript
const SERVICE_ID = 'your_service_id';
const TEMPLATE_ID = 'your_template_id';
const PUBLIC_KEY = 'your_public_key';
```

For detailed EmailJS setup, see [EMAILJS_SETUP.md](./EMAILJS_SETUP.md)

### Step 4: Start the Development Server

Run the following command:

```bash
npm start
```

You should see output like:

```
webpack 5.x.x compiled successfully
Project is running at http://localhost:8080
webpack compiled successfully
```

### Step 5: Open in Browser

Open your web browser and navigate to:

```
http://localhost:8080
```

The application should load and show the landing page (or login page if you've already configured Firebase).

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Application loads without errors
- [ ] Can create a new account (signup)
- [ ] Can login with created account
- [ ] Can see the main form page after login
- [ ] Can fill out the fit test form
- [ ] Can see the e-card preview
- [ ] Can save test results to Firebase (Test Save button)
- [ ] Can view test results in "Test Results" page
- [ ] Dark mode toggle works
- [ ] Can edit account information
- [ ] Can logout and login again

## 🐛 Troubleshooting

### Port Already in Use

If port 8080 is already in use:

1. Find and stop the process using port 8080
2. Or modify `webpack.config.js` to use a different port

### Firebase Errors

**Error: "Firebase: Error (auth/configuration-not-found)"**
- Check that `firebase.js` has correct configuration values
- Ensure Firebase project is active

**Error: "Missing or insufficient permissions"**
- Check Firestore security rules
- For development, use test mode rules

**Error: "The query requires an index"**
- Click the link in the error message to create the index
- Or manually create it in Firestore Console

### EmailJS Errors

**Error: "Invalid Public Key"**
- Verify PUBLIC_KEY in `emailService.js`
- Check EmailJS dashboard for correct key

**Error: "Email shows HTML code instead of formatted e-card"**
- Ensure template content type is set to HTML
- Check that template uses `{{html_message}}` variable

### Build Errors

**Error: "Module not found"**
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

**Error: "Cannot find module"**
- Check file paths in imports
- Ensure all files exist in correct locations

### Authentication Issues

**Can't login after signup**
- Check browser console for errors
- Verify Firebase Authentication is enabled
- Check Firestore rules allow read/write

## 🎯 Next Steps

Once the application is running:

1. **Create your first account**: Use the signup page to create an account
2. **Test the form**: Fill out a fit test form and preview the e-card
3. **Test database**: Use "Test Save to Firebase" button to save records
4. **Configure EmailJS**: Set up email sending (optional)
5. **Explore features**: Try dark mode, edit account, view results

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [EmailJS Documentation](https://www.emailjs.com/docs/)
- [React Documentation](https://react.dev/)
- [Webpack Documentation](https://webpack.js.org/)

## 💡 Tips

- **Development Mode**: Use `npm start` for development with hot reload
- **Production Build**: Use `npm run build` to create optimized production build
- **Browser DevTools**: Use browser console to debug issues
- **Firebase Console**: Monitor database and authentication in Firebase Console
- **EmailJS Dashboard**: Check email sending logs in EmailJS dashboard

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review the detailed setup guides:
   - [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
   - [EMAILJS_SETUP.md](./EMAILJS_SETUP.md)
3. Check browser console for error messages
4. Verify all configuration values are correct
5. Ensure all prerequisites are installed

---

**Happy coding!** 🚀

