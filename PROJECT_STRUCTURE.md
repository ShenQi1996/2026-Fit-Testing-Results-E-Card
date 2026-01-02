# Project Structure

This document describes the reorganized project structure for better maintainability and scalability.

## Folder Structure

```
src/
├── components/
│   ├── auth/                    # Authentication components
│   │   ├── Login.js
│   │   ├── Signup.js
│   │   ├── EditAccount.js
│   │   ├── Auth.css
│   │   └── EditAccount.css
│   ├── common/                  # Shared/reusable components
│   │   ├── Header.js
│   │   ├── Header.css
│   │   ├── Sidebar.js
│   │   ├── Sidebar.css
│   │   ├── CardPreview.js
│   │   ├── CardPreview.css
│   │   ├── EmailForm.css        # Shared form styles
│   │   ├── FormInput.js         # Reusable input component
│   │   ├── FormSelect.js        # Reusable select component
│   │   ├── FormSection.js       # Reusable section wrapper
│   │   └── StatusMessage.js     # Status/error message component
│   ├── forms/                   # Form-specific components
│   │   ├── EmailForm.js         # Main form container
│   │   ├── RecipientInfoSection.js
│   │   ├── ClientInfoSection.js
│   │   ├── FitTestDetailsSection.js
│   │   └── SubmitButton.js
│   └── results/                 # Test results components
│       ├── TestResults.js
│       └── TestResults.css
├── context/                     # React Context providers
│   ├── AuthContext.js          # Authentication state management
│   └── ThemeContext.js         # Dark mode theme management
├── hooks/                       # Custom React hooks
│   └── useEmailForm.js         # Email form logic hook
├── services/                    # External service integrations
│   ├── emailService.js         # EmailJS service wrapper
│   ├── firebaseAuth.js         # Firebase authentication service
│   └── firebaseDb.js           # Firebase Firestore service
├── utils/                       # Utility functions
│   ├── dateUtils.js            # Date formatting utilities
│   ├── validators.js           # Form validation functions
│   └── ecardTemplates.js      # E-card HTML templates
├── config/                      # Configuration files
│   └── firebase.js             # Firebase configuration
├── styles/                      # Global styles
│   └── App.css                 # Main app styles with CSS variables
├── App.js                       # Main app component
└── index.js                     # Entry point
```

## Component Breakdown

### Before Reorganization
- **EmailForm.js**: 321 lines (too large!)
- All components in one folder
- Mixed concerns (UI, logic, services)

### After Reorganization
- **EmailForm.js**: ~40 lines (just composition!)
- **useEmailForm.js**: ~70 lines (form logic)
- **emailService.js**: ~30 lines (email sending)
- **Form sections**: ~20-50 lines each (focused components)

## Component Responsibilities

### Auth Components (`components/auth/`)
- **Login.js**: User login form
- **Signup.js**: User registration form
- **EditAccount.js**: Account editing form

### Common Components (`components/common/`)
- **Header.js**: App navigation header with theme toggle
- **Sidebar.js**: Left sidebar navigation
- **CardPreview.js**: E-card preview display
- **FormInput.js**: Reusable text input with error handling
- **FormSelect.js**: Reusable dropdown select
- **FormSection.js**: Form section wrapper
- **StatusMessage.js**: Success/error messages

### Form Components (`components/forms/`)
- **EmailForm.js**: Main form container (orchestrates sections)
- **RecipientInfoSection.js**: Recipient email input
- **ClientInfoSection.js**: Client name and DOB (with auto-formatting)
- **FitTestDetailsSection.js**: All fit test fields
- **SubmitButton.js**: Form submit button

### Results Components (`components/results/`)
- **TestResults.js**: Display, edit, delete, and resend test results
- **TestResults.css**: Calendar-style monthly grouping

## Context (`context/`)

### AuthContext
- User authentication state
- Login, signup, logout functions
- User profile management
- Session persistence

### ThemeContext
- Dark mode state management
- Theme toggle functionality
- localStorage persistence

## Hooks (`hooks/`)

### useEmailForm
- Manages form state
- Handles form submission
- Validates form data
- Manages loading/error states
- Auto-fills fit tester name
- Handles date formatting

## Services (`services/`)

### emailService.js
- EmailJS configuration
- Email sending logic
- Template parameter preparation
- HTML email generation

### firebaseAuth.js
- Firebase authentication operations
- Email/password authentication
- Google sign-in
- User profile management

### firebaseDb.js
- Firestore database operations
- Save fit test records
- Fetch user's fit tests
- Update and delete records
- Error handling with index creation links

## Utils (`utils/`)

### dateUtils.js
- Date formatting functions
- `getTodayDate()` - Returns today in MM/DD/YYYY
- `formatDateInput()` - Auto-formats dates to MM/DD/YYYY

### validators.js
- Email validation
- Form validation
- `validateFitTestForm()` - Validates entire form

### ecardTemplates.js
- HTML e-card template generation
- `generateFitTestCard()` - Creates HTML card

## Benefits of This Structure

1. **Smaller Components**: Each component has a single responsibility
2. **Reusability**: Common components can be used across the app
3. **Maintainability**: Easy to find and update specific functionality
4. **Testability**: Smaller components are easier to test
5. **Scalability**: Easy to add new features without bloating existing files
6. **Separation of Concerns**: Logic, UI, and services are separated

## File Size Comparison

| Component | Before | After |
|-----------|--------|-------|
| EmailForm | 321 lines | ~40 lines |
| Form Logic | Mixed in | 70 lines (hook) |
| Email Service | Mixed in | 30 lines (service) |
| Form Sections | Mixed in | 20-50 lines each |

## Adding New Features

### Add a new form section:
1. Create component in `components/forms/`
2. Import and use in `EmailForm.js`

### Add a new validation:
1. Add function to `utils/validators.js`
2. Use in `hooks/useEmailForm.js`

### Add a new service:
1. Create file in `services/`
2. Import where needed

### Add a reusable component:
1. Create in `components/common/`
2. Export and use across app

