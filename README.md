# Fit Testing Results E-Card Application

A professional React application for Secure Fit LLC that enables medical fit testing agents to generate, send, and manage respiratory fit testing results via digital e-cards.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Development](#development)
- [Build & Deploy](#build--deploy)

## 🎯 Project Overview

This application streamlines the respiratory fit testing workflow for medical professionals. It allows fit testing agents to:

- Create professional fit test result e-cards
- Send results directly to clients via email
- Manage and track all fit test records
- Maintain compliance with OSHA regulations
- Access historical test data organized by date

For detailed information, see [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)

## ✨ Features

### Core Functionality
- **Professional E-Card Generation**: Beautifully formatted HTML e-cards with Secure Fit LLC branding
- **Email Integration**: Send e-cards directly via EmailJS
- **Digital Records Management**: Store and retrieve all fit test records in Firebase
- **User Authentication**: Secure login/signup with Firebase Authentication (including Google Sign-In)
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

### Form Features
- **Complete Fit Test Form**: All required fields for OSHA-compliant documentation
- **Respiratory Protection Program Verification**: Track schools on file, program administrator information
- **Auto-Fill Capabilities**: 
  - Issue date defaults to today
  - Fit tester auto-fills with logged-in user's name
  - Date of Birth auto-formats to MM/DD/YYYY
  - Schools on file checkbox defaults to checked
- **Live Preview**: See exactly how the e-card will look before sending
- **Form Validation**: Visual feedback with red borders for required fields
- **QR Code Generation**: Automatic QR codes linking to rescheduling page
- **Digital Signature**: Canvas-based signature pad with clear functionality

### Results Management
- **Fit Test Results Page**: View all fit test records organized by month
- **Inline Editing**: Edit records directly from the results page
- **Resend E-Cards**: Resend e-cards to clients with updated timestamps
- **Delete Records**: Remove records with confirmation modal
- **Sorting**: Results sorted by issue date (newest first)
- **Calendar View**: Monthly grouping for easy navigation

### User Features
- **Account Management**: Edit profile information
- **Session Persistence**: Stay logged in across browser sessions
- **Google Sign-In**: Quick authentication with Google account

## 🛠 Tech Stack

- **Frontend Framework**: React 18.2.0
- **Build Tool**: Webpack 5
- **Styling**: CSS with CSS Variables (dark mode support)
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **Email Service**: EmailJS
- **State Management**: React Context API
- **Icons**: Emoji-based icons

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account
- EmailJS account (optional, for email sending)

### Quick Start

1. **Clone the repository**
   ```bash
   cd email-form-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed instructions
   - Update `src/config/firebase.js` with your Firebase credentials

4. **Configure EmailJS** (Optional)
   - See [EMAILJS_SETUP.md](./EMAILJS_SETUP.md) for detailed instructions
   - Update `src/services/emailService.js` with your EmailJS credentials

5. **Start development server**
   ```bash
   npm start
   ```

6. **Open in browser**
   - Navigate to `http://localhost:8080` (or the port shown in terminal)

For detailed setup instructions, see [HOW_TO_RUN.md](./HOW_TO_RUN.md)

## 📁 Project Structure

```
email-form-app/
├── src/
│   ├── components/
│   │   ├── auth/              # Authentication components
│   │   │   ├── Login.js
│   │   │   ├── Signup.js
│   │   │   ├── EditAccount.js
│   │   │   ├── Auth.css
│   │   │   └── EditAccount.css
│   │   ├── common/            # Reusable components
│   │   │   ├── Header.js
│   │   │   ├── Sidebar.js
│   │   │   ├── CardPreview.js
│   │   │   ├── FormInput.js
│   │   │   ├── FormSelect.js
│   │   │   ├── FormSection.js
│   │   │   └── StatusMessage.js
│   │   ├── forms/             # Form section components
│   │   │   ├── FitTestForm.js         # Main form container
│   │   │   ├── FitTestForm.css        # Form styles
│   │   │   ├── RecipientInfoSection.js
│   │   │   ├── ClientInfoSection.js
│   │   │   ├── FitTestDetailsSection.js
│   │   │   ├── RespiratoryProtectionProgramSection.js
│   │   │   ├── SignatureSection.js
│   │   │   ├── SignaturePad.js
│   │   │   └── SubmitButton.js
│   │   └── results/           # Test results components
│   │       ├── FitTestResults.js
│   │       └── FitTestResults.css
│   ├── context/               # React Context providers
│   │   ├── AuthContext.js
│   │   └── ThemeContext.js
│   ├── hooks/                 # Custom React hooks
│   │   └── useFitTestForm.js  # Fit test form logic hook
│   ├── services/              # External service integrations
│   │   ├── emailService.js
│   │   ├── firebaseAuth.js
│   │   └── firebaseDb.js
│   ├── utils/                 # Utility functions
│   │   ├── dateUtils.js
│   │   ├── validators.js
│   │   └── fitTestCardTemplate.js  # E-card HTML templates
│   ├── config/                # Configuration files
│   │   └── firebase.js
│   ├── styles/                # Global styles
│   │   └── App.css
│   ├── App.js                 # Main app component
│   └── index.js               # Entry point
├── public/                     # Static files
├── docs/                       # Documentation files
└── package.json
```

For detailed structure information, see [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

## ⚙️ Configuration

### Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password and Google)
3. Create a Firestore database
4. Copy your config to `src/config/firebase.js`

### EmailJS Configuration

1. Sign up at [EmailJS](https://www.emailjs.com/)
2. Create an email service
3. Create an email template
4. Update `src/services/emailService.js` with your credentials

See individual setup guides for detailed instructions.

## 📚 Documentation

- **[HOW_TO_RUN.md](./HOW_TO_RUN.md)**: Step-by-step setup and running instructions
- **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**: Detailed project description and features
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)**: Code organization and architecture
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**: Firebase configuration guide
- **[EMAILJS_SETUP.md](./EMAILJS_SETUP.md)**: EmailJS setup and template configuration
- **[USER_SYSTEM_GUIDE.md](./USER_SYSTEM_GUIDE.md)**: User authentication system documentation

## 💻 Development

### Available Scripts

- `npm start` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode

### Development Guidelines

- Follow the existing component structure
- Use CSS variables for theming (dark mode support)
- Keep components small and focused
- Use custom hooks for reusable logic
- Follow React best practices

## 🏗 Build & Deploy

### Production Build

```bash
npm run build
```

The production build will be in the `dist` folder.

### Deployment Options

- **Vercel**: Connect your GitHub repo for automatic deployments
- **Netlify**: Drag and drop the `dist` folder
- **Firebase Hosting**: Use `firebase deploy`
- **Any static hosting**: Upload the `dist` folder contents

## 🔒 Security Notes

- Firebase handles authentication securely
- Passwords are hashed by Firebase
- All data is stored in Firebase (not localStorage)
- EmailJS credentials should be kept secure
- For production, consider environment variables for sensitive config

## 📝 License

ISC

## 👥 Support

For issues or questions, please refer to the documentation files or create an issue in the repository.

---

**Secure Fit LLC** - Precision in every breath.
