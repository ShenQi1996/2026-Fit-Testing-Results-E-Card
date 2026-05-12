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
│   │   ├── FormInput.js         # Reusable input component
│   │   ├── FormSelect.js        # Reusable select component
│   │   ├── FormSection.js       # Reusable section wrapper
│   │   └── StatusMessage.js     # Status/error message component
│   ├── forms/                   # Form-specific components
│   │   ├── FitTestForm.js       # Main form container
│   │   ├── FitTestForm.css      # Form styles
│   │   ├── RecipientInfoSection.js
│   │   ├── ClientInfoSection.js
│   │   ├── FitTestDetailsSection.js
│   │   ├── RespiratoryProtectionProgramSection.js
│   │   ├── SignatureSection.js
│   │   ├── SignaturePad.js
│   │   └── SubmitButton.js
│   └── results/                 # Test results components
│       ├── FitTestResults.js
│       └── FitTestResults.css
├── context/                     # React Context providers
│   ├── AuthContext.js          # Authentication state management
│   └── ThemeContext.js         # Dark mode theme management
├── hooks/                       # Custom React hooks
│   └── useFitTestForm.js       # Fit test form logic hook
├── services/                    # External service integrations
│   ├── emailService.js         # EmailJS service wrapper
│   ├── firebaseAuth.js         # Firebase authentication service
│   └── firebaseDb.js           # Firebase Firestore service
├── utils/                       # Utility functions
│   ├── dateUtils.js            # Date formatting utilities
│   ├── validators.js           # Form validation functions
│   └── fitTestCardTemplate.js  # E-card HTML templates
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
- **FitTestForm.js**: ~80 lines (just composition!)
- **useFitTestForm.js**: ~193 lines (form logic)
- **emailService.js**: ~68 lines (email sending)
- **Form sections**: ~20-80 lines each (focused components)

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
- **FitTestForm.js**: Main form container (orchestrates sections)
- **FitTestForm.css**: Form styles and responsive design
- **RecipientInfoSection.js**: Recipient email input
- **ClientInfoSection.js**: Client name and DOB (with auto-formatting)
- **FitTestDetailsSection.js**: All fit test fields
- **RespiratoryProtectionProgramSection.js**: Respiratory protection program verification
- **SignatureSection.js**: Signature pad and consent statement
- **SignaturePad.js**: Canvas-based signature component
- **SubmitButton.js**: Form submit button

### Results Components (`components/results/`)
- **FitTestResults.js**: Display, edit, delete, and resend test results
- **FitTestResults.css**: Calendar-style monthly grouping

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

### useFitTestForm
- Manages form state
- Handles form submission
- Validates form data
- Manages loading/error states
- Auto-fills fit tester name
- Handles date formatting
- Manages signature canvas
- Resets form state

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

### fitTestCardTemplate.js
- HTML e-card template generation
- `generateFitTestCard()` - Creates HTML card
- `getCardTemplate()` - Returns template functions

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
| FitTestForm | 321 lines | ~80 lines |
| Form Logic | Mixed in | 193 lines (hook) |
| Email Service | Mixed in | 68 lines (service) |
| Form Sections | Mixed in | 20-80 lines each |

## Adding New Features

### Add a new form section:
1. Create component in `components/forms/`
2. Import and use in `FitTestForm.js`
3. Add form data fields to `hooks/useFitTestForm.js` if needed

### Add a new validation:
1. Add function to `utils/validators.js`
2. Use in `hooks/useFitTestForm.js`

### Add a new service:
1. Create file in `services/`
2. Import where needed

### Add a reusable component:
1. Create in `components/common/`
2. Export and use across app

