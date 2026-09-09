import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTodayDate, calculateExpirationDate } from '../utils/dateUtils';
import { validateFitTestForm } from '../utils/validators';
import { sendFitTestCard } from '../services/emailService';
import {
  saveFitTest,
  getUserSolutionProfiles,
  saveUserSolutionProfile,
  getUserSchoolProfiles,
  saveUserSchoolProfile,
} from '../services/firebaseDb';
import { TESTING_AGENT_OPTIONS, SCHOOLS_OPTIONS } from '../constants/fitTestOptions';
import { createVerificationToken } from '../utils/verificationToken';

const INITIAL_FORM_DATA = {
  recipientEmail: '',
  clientName: '',
  dob: '',
  testLocation: 'Harlem',
  issueDate: getTodayDate(),
  fitTestType: 'N95',
  fitTestMethod: 'Locked to Qualitative', 
  respiratorMfg: '3M',
  testingAgent: 'Bitrex',
  maskSize: 'Regular',
  model: '',
  result: 'Pass',
  fitTester: '',
  printedName: '', 
  schoolsOnFile: true,
  schoolsList: SCHOOLS_OPTIONS[0]?.value || '',
  programAdministratorName: '',
  programAdministratorContact: '',
  // Fit test invalidation conditions
  facialHairInterfering: false, // Default NO (unchecked)
  respiratorDonnedCorrectly: true, // Default YES (checked)
  employeeSealCheckInstructionProvided: true, // Default checked
  failureReason: '',
  correctiveActionNote: '',
  // Sensitivity screening documentation
  sensitivityScreeningPerformed: true, // Default checked
  sensitivityDetected: true, // Default checked
  // Required exercise checklist (OSHA Appendix A protocol)
  exerciseNormalBreathing: true, // Default checked
  exerciseDeepBreathing: true, // Default checked
  exerciseHeadSideToSide: true, // Default checked
  exerciseHeadUpAndDown: true, // Default checked
  exerciseTalking: true, // Default checked
  exerciseBendingOverOrJogging: true, // Default checked
  exerciseNormalBreathingAgain: true, // Default checked
  // Equipment hygiene and solution control
  solutionType: TESTING_AGENT_OPTIONS[0]?.value || '',
  solutionOpenDate: '',
  solutionExpirationDate: '',
  cleaningMethod: 'Condition acceptable',
  hoodCleaned: true, // Default checked
  nebulizerCleaned: true, // Default checked
  // Consent section — required choices stay unchecked until the participant confirms
  studentClearanceConfirmed: false,
  consentToFitTest: false,
  privacyPolicyAcknowledged: false,
  recordDeliveryConfirmed: false,
  optionalOrganizationRelease: false,
  organizationReleaseRecipient: '',
  optionalMarketingEmail: false,
  // Tester attestation checkboxes
  testerAttestationProtocolFollowed: true, // Default checked
  testerAttestationConsentWitnessed: true, // Default checked
  testerAttestationRespiratorMatchesRecord: true, // Default checked
  testerMedicalRestrictionsReceived: null,
  testerMedicalRestrictionsNote: '',
};

const createInitialFormData = (overrides = {}) => ({
  ...INITIAL_FORM_DATA,
  issueDate: getTodayDate(),
  verificationToken: createVerificationToken(),
  ...overrides,
});

const NEW_SOLUTION_PROFILE_OPTION = '__new_solution_profile__';
const BASE_SOLUTION_OPTION_PREFIX = 'base:';
const PROFILE_SOLUTION_OPTION_PREFIX = 'profile:';
const NEW_SCHOOL_PROFILE_OPTION = '__new_school_profile__';
const BASE_SCHOOL_OPTION_PREFIX = 'school-base:';
const PROFILE_SCHOOL_OPTION_PREFIX = 'school-profile:';

const getDefaultBaseSolutionType = () => TESTING_AGENT_OPTIONS[0]?.value || '';
const getDefaultBaseSchool = () => SCHOOLS_OPTIONS[0]?.value || '';

export const useFitTestForm = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState(() => createInitialFormData());
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasStrokes, setHasStrokes] = useState(false);
  const [hasTesterStrokes, setHasTesterStrokes] = useState(false);
  const signatureCanvasRef = useRef(null);
  const testerSignatureCanvasRef = useRef(null);
  const printedNameManuallyEdited = useRef(false);
  const [solutionProfiles, setSolutionProfiles] = useState([]);
  const [solutionTypeOptions, setSolutionTypeOptions] = useState([]);
  const [selectedSolutionOption, setSelectedSolutionOption] = useState(`${BASE_SOLUTION_OPTION_PREFIX}${getDefaultBaseSolutionType()}`);
  const [setSolutionProfileAsDefault, setSetSolutionProfileAsDefault] = useState(false);
  const [isLoadingSolutionProfiles, setIsLoadingSolutionProfiles] = useState(false);
  const [schoolProfiles, setSchoolProfiles] = useState([]);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [selectedSchoolOption, setSelectedSchoolOption] = useState(
    `${BASE_SCHOOL_OPTION_PREFIX}${getDefaultBaseSchool()}`
  );
  const [setSchoolProfileAsDefault, setSetSchoolProfileAsDefault] = useState(false);
  const [isLoadingSchoolProfiles, setIsLoadingSchoolProfiles] = useState(false);

  const buildSolutionTypeOptions = (profiles) => {
    const savedProfileOptions = profiles.map((profile) => ({
      value: `${PROFILE_SOLUTION_OPTION_PREFIX}${profile.id}`,
      label: `Saved: ${profile.solutionType} | Open: ${profile.solutionOpenDate} | Exp: ${profile.solutionExpirationDate}${profile.isDefault ? ' (Default)' : ''}`,
    }));

    const baseOptions = TESTING_AGENT_OPTIONS.map((option) => ({
      value: `${BASE_SOLUTION_OPTION_PREFIX}${option.value}`,
      label: `Base: ${option.label}`,
    }));

    return [
      ...savedProfileOptions,
      ...baseOptions,
      { value: NEW_SOLUTION_PROFILE_OPTION, label: '+ Add new solution profile' },
    ];
  };

  const applySolutionSelection = (optionValue, profilesToUse = solutionProfiles) => {
    setSelectedSolutionOption(optionValue);

    if (optionValue === NEW_SOLUTION_PROFILE_OPTION) {
      setFormData((prev) => ({
        ...prev,
        solutionType: '',
        solutionOpenDate: '',
        solutionExpirationDate: '',
      }));
      return;
    }

    if (optionValue.startsWith(BASE_SOLUTION_OPTION_PREFIX)) {
      const baseValue = optionValue.replace(BASE_SOLUTION_OPTION_PREFIX, '');
      setFormData((prev) => ({
        ...prev,
        solutionType: baseValue,
      }));
      return;
    }

    if (optionValue.startsWith(PROFILE_SOLUTION_OPTION_PREFIX)) {
      const profileId = optionValue.replace(PROFILE_SOLUTION_OPTION_PREFIX, '');
      const profile = profilesToUse.find((item) => item.id === profileId);
      if (profile) {
        setFormData((prev) => ({
          ...prev,
          solutionType: profile.solutionType || getDefaultBaseSolutionType(),
          solutionOpenDate: profile.solutionOpenDate || '',
          solutionExpirationDate: profile.solutionExpirationDate || '',
        }));
      }
    }
  };

  const loadSolutionProfiles = async (userId) => {
    if (!userId) {
      setSolutionProfiles([]);
      setSolutionTypeOptions(buildSolutionTypeOptions([]));
      return [];
    }

    setIsLoadingSolutionProfiles(true);
    try {
      const profiles = await getUserSolutionProfiles(userId);
      setSolutionProfiles(profiles);
      setSolutionTypeOptions(buildSolutionTypeOptions(profiles));
      return profiles;
    } catch (error) {
      console.error('Error loading solution profiles:', error);
      setStatus({ type: 'warning', message: error?.message || 'Could not load saved solution profiles.' });
      setSolutionProfiles([]);
      setSolutionTypeOptions(buildSolutionTypeOptions([]));
      return [];
    } finally {
      setIsLoadingSolutionProfiles(false);
    }
  };

  const buildSchoolOptions = (profiles) => {
    const savedProfileOptions = profiles.map((profile) => ({
      value: `${PROFILE_SCHOOL_OPTION_PREFIX}${profile.id}`,
      label: `Saved: ${profile.schoolName}${profile.isDefault ? ' (Default)' : ''}`,
    }));

    const baseOptions = SCHOOLS_OPTIONS.map((option) => ({
      value: `${BASE_SCHOOL_OPTION_PREFIX}${option.value}`,
      label: option.label,
    }));

    return [
      ...savedProfileOptions,
      ...baseOptions,
      { value: NEW_SCHOOL_PROFILE_OPTION, label: 'Other / Add new school' },
    ];
  };

  const applySchoolSelection = (optionValue, profilesToUse = schoolProfiles) => {
    setSelectedSchoolOption(optionValue);

    if (optionValue === NEW_SCHOOL_PROFILE_OPTION) {
      setFormData((prev) => ({
        ...prev,
        schoolsList: '',
      }));
      return;
    }

    if (optionValue.startsWith(BASE_SCHOOL_OPTION_PREFIX)) {
      const baseValue = optionValue.replace(BASE_SCHOOL_OPTION_PREFIX, '');
      setFormData((prev) => ({
        ...prev,
        schoolsList: baseValue,
      }));
      return;
    }

    if (optionValue.startsWith(PROFILE_SCHOOL_OPTION_PREFIX)) {
      const profileId = optionValue.replace(PROFILE_SCHOOL_OPTION_PREFIX, '');
      const profile = profilesToUse.find((item) => item.id === profileId);
      if (profile) {
        setFormData((prev) => ({
          ...prev,
          schoolsList: profile.schoolName || '',
        }));
      }
    }
  };

  const loadSchoolProfiles = async (userId) => {
    if (!userId) {
      setSchoolProfiles([]);
      setSchoolOptions(buildSchoolOptions([]));
      return [];
    }

    setIsLoadingSchoolProfiles(true);
    try {
      const profiles = await getUserSchoolProfiles(userId);
      setSchoolProfiles(profiles);
      setSchoolOptions(buildSchoolOptions(profiles));
      return profiles;
    } catch (error) {
      console.error('Error loading school profiles:', error);
      setStatus({ type: 'warning', message: error?.message || 'Could not load saved school profiles.' });
      setSchoolProfiles([]);
      setSchoolOptions(buildSchoolOptions([]));
      return [];
    } finally {
      setIsLoadingSchoolProfiles(false);
    }
  };

  // Always set fitTester to logged-in user's name (read-only field)
  useEffect(() => {
    if (user && user.name) {
      setFormData(prev => ({
        ...prev,
        fitTester: user.name
      }));
    }
  }, [user]);

  // Load saved solution profiles and apply user's default profile
  useEffect(() => {
    const initializeSolutionProfiles = async () => {
      if (!user?.uid) {
        setSolutionProfiles([]);
        setSolutionTypeOptions(buildSolutionTypeOptions([]));
        setSelectedSolutionOption(`${BASE_SOLUTION_OPTION_PREFIX}${getDefaultBaseSolutionType()}`);
        return;
      }

      const profiles = await loadSolutionProfiles(user.uid);
      const defaultProfile = profiles.find((profile) => profile.isDefault);

      if (defaultProfile) {
        applySolutionSelection(`${PROFILE_SOLUTION_OPTION_PREFIX}${defaultProfile.id}`, profiles);
      } else {
        setSelectedSolutionOption(`${BASE_SOLUTION_OPTION_PREFIX}${getDefaultBaseSolutionType()}`);
      }
    };

    initializeSolutionProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Load saved school profiles and apply user's default school
  useEffect(() => {
    const initializeSchoolProfiles = async () => {
      if (!user?.uid) {
        setSchoolProfiles([]);
        setSchoolOptions(buildSchoolOptions([]));
        applySchoolSelection(`${BASE_SCHOOL_OPTION_PREFIX}${getDefaultBaseSchool()}`, []);
        return;
      }

      const profiles = await loadSchoolProfiles(user.uid);
      const defaultProfile = profiles.find((profile) => profile.isDefault);

      if (defaultProfile) {
        applySchoolSelection(`${PROFILE_SCHOOL_OPTION_PREFIX}${defaultProfile.id}`, profiles);
      } else {
        applySchoolSelection(`${BASE_SCHOOL_OPTION_PREFIX}${getDefaultBaseSchool()}`, profiles);
      }
    };

    initializeSchoolProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleInputChange = (field, value) => {
    // Prevent changes to fitTester - it's read-only and always set to user's name
    if (field === 'fitTester') {
      return;
    }
    // Prevent changes to fitTestMethod - it's locked to Qualitative
    if (field === 'fitTestMethod') {
      return;
    }
    
    setFormData(prev => {
      const updates = {
        ...prev,
        [field]: value
      };
      
      // Auto-fill printedName when clientName changes (only if printedName hasn't been manually edited)
      if (field === 'clientName' && !printedNameManuallyEdited.current) {
        // Always sync printedName with clientName unless it was manually edited
        // Check if printedName was previously auto-filled by comparing with previous clientName
        const prevPrintedName = (prev.printedName || '').trim();
        const prevClientName = (prev.clientName || '').trim();
        
        // Sync if printedName matches previous clientName (was auto-filled) or is empty
        if (prevPrintedName === prevClientName || prevPrintedName === '') {
          updates.printedName = value.trim();
        }
      }
      
      return updates;
    });
    
    // Track if printedName is being manually edited
    if (field === 'printedName') {
      // Check if the new value differs from current clientName (user is manually editing)
      if (value.trim() !== formData.clientName?.trim()) {
        printedNameManuallyEdited.current = true;
      } else {
        // If it matches clientName again, reset the flag (user synced it back)
        printedNameManuallyEdited.current = false;
      }
    }
    
    // Reset manual edit flag if clientName is cleared or if printedName matches new clientName
    if (field === 'clientName') {
      if (!value || value.trim() === '') {
        printedNameManuallyEdited.current = false;
      } else if (formData.printedName === value.trim()) {
        // If printedName already matches the new clientName, it's synced
        printedNameManuallyEdited.current = false;
      }
    }
    
    // Clear error for this field when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Clear printedName error when clientName changes and auto-fills printedName
    if (field === 'clientName' && !printedNameManuallyEdited.current && fieldErrors.printedName) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.printedName;
        return newErrors;
      });
    }
  };

  const handleSignatureStroke = (hasStrokesValue) => {
    setHasStrokes(hasStrokesValue);
    // Clear signature error when user starts drawing
    if (fieldErrors.signature) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.signature;
        return newErrors;
      });
    }
  };

  const handleSignatureClear = () => {
    setHasStrokes(false);
  };

  const handleTesterSignatureStroke = (hasStrokesValue) => {
    setHasTesterStrokes(hasStrokesValue);
    // Clear tester signature error when user starts drawing
    if (fieldErrors.testerSignature) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.testerSignature;
        return newErrors;
      });
    }
  };

  const handleTesterSignatureClear = () => {
    setHasTesterStrokes(false);
  };

  const setSignatureCanvasRef = (ref) => {
    signatureCanvasRef.current = ref;
  };

  const setTesterSignatureCanvasRef = (ref) => {
    testerSignatureCanvasRef.current = ref;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Creating a new solution profile always requires full details.
    const shouldSaveProfile = selectedSolutionOption === NEW_SOLUTION_PROFILE_OPTION;
    const shouldSaveSchoolProfile = selectedSchoolOption === NEW_SCHOOL_PROFILE_OPTION;

    if (shouldSaveProfile) {
      const profileFieldErrors = {};
      if (!formData.solutionType?.trim()) {
        profileFieldErrors.solutionType = 'Please enter solution type.';
      }
      if (!formData.solutionOpenDate?.trim()) {
        profileFieldErrors.solutionOpenDate = 'Please enter solution open date.';
      }
      if (!formData.solutionExpirationDate?.trim()) {
        profileFieldErrors.solutionExpirationDate = 'Please enter solution expiration date.';
      }

      if (Object.keys(profileFieldErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...profileFieldErrors }));
        setStatus({ type: 'error', message: Object.values(profileFieldErrors)[0] });
        return;
      }
    }

    if (shouldSaveSchoolProfile && !formData.schoolsList?.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        schoolsList: 'Please enter the school name.',
      }));
      setStatus({ type: 'error', message: 'Please enter the school name.' });
      return;
    }

    // Validate form
    const validation = validateFitTestForm(formData, hasStrokes, hasTesterStrokes);
    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      setStatus({ type: 'error', message: validation.error });
      return;
    }

    setIsLoading(true);
    setStatus({ type: '', message: '' });

    try {
      let latestSolutionProfiles = solutionProfiles;
      let latestSchoolProfiles = schoolProfiles;

      // Persist solution/school profile preferences before submitting the e-card.
      if (user?.uid) {
        if (selectedSolutionOption === NEW_SOLUTION_PROFILE_OPTION) {
          const savedProfileId = await saveUserSolutionProfile(
            user.uid,
            {
              solutionType: formData.solutionType,
              solutionOpenDate: formData.solutionOpenDate,
              solutionExpirationDate: formData.solutionExpirationDate,
            },
            setSolutionProfileAsDefault
          );

          const refreshedProfiles = await loadSolutionProfiles(user.uid);
          latestSolutionProfiles = refreshedProfiles;
          applySolutionSelection(`${PROFILE_SOLUTION_OPTION_PREFIX}${savedProfileId}`, refreshedProfiles);
        }

        if (selectedSchoolOption === NEW_SCHOOL_PROFILE_OPTION) {
          const savedSchoolProfileId = await saveUserSchoolProfile(
            user.uid,
            { schoolName: formData.schoolsList },
            setSchoolProfileAsDefault
          );

          const refreshedSchoolProfiles = await loadSchoolProfiles(user.uid);
          latestSchoolProfiles = refreshedSchoolProfiles;
          applySchoolSelection(`${PROFILE_SCHOOL_OPTION_PREFIX}${savedSchoolProfileId}`, refreshedSchoolProfiles);
        }
      }

      // Capture signature as data URL
      let signatureDataUrl = '';
      if (signatureCanvasRef.current) {
        const canvas = signatureCanvasRef.current;
        signatureDataUrl = canvas.toDataURL('image/png');
      }
      
      // Capture tester signature as data URL
      let testerSignatureDataUrl = '';
      if (testerSignatureCanvasRef.current) {
        const canvas = testerSignatureCanvasRef.current;
        testerSignatureDataUrl = canvas.toDataURL('image/png');
      } 
      // Prepare form data with signature
      // Clear failure reason fields if UI is not visible (not a problem condition)
      const showFailureReasonUI = formData.facialHairInterfering === true || formData.respiratorDonnedCorrectly === false;
      const cleanedFormData = {
        ...formData,
        printedName: formData.printedName.trim(),
        testLocation: formData.testLocation?.trim() || '',
        // Always set fitTester to logged-in user's name (read-only field)
        fitTester: user?.name || formData.fitTester || '',
        // Always set fitTestMethod to Locked to Qualitative (locked field)
        fitTestMethod: 'Locked to Qualitative',
        // Clear failure reason fields if UI is not visible
        failureReason: showFailureReasonUI ? formData.failureReason : '',
        correctiveActionNote: showFailureReasonUI ? formData.correctiveActionNote : '',
        testerMedicalRestrictionsNote: formData.testerMedicalRestrictionsReceived === true
          ? (formData.testerMedicalRestrictionsNote || '').trim()
          : '',
      };
      
      // Calculate expiration date (test date + 1 year)
      const expirationDate = calculateExpirationDate(cleanedFormData.issueDate);
      
      const formDataWithSignature = {
        ...cleanedFormData,
        signatureDataUrl,
        testerSignatureDataUrl,
        expirationDate, // Add expiration date (issueDate + 1 year)
        verificationToken: cleanedFormData.verificationToken || createVerificationToken(),
      };

      // Save first so the e-card QR can verify as soon as the email arrives.
      if (user && user.uid) {
        try {
          await saveFitTest(user.uid, formDataWithSignature);
        } catch (dbError) {
          console.error('Error saving to database:', dbError);
          setStatus({
            type: 'error',
            message: 'Could not save the fit test record, so the e-card was not sent. Please try again.',
          });
          setIsLoading(false);
          return;
        }
      } else {
        console.warn('User not logged in, skipping database save');
      }

      try {
        await sendFitTestCard(formDataWithSignature);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        setStatus({
          type: 'warning',
          message: user?.uid
            ? 'Record saved, but the e-card email failed. You can resend it from Results.'
            : 'Failed to send e-card. Please try again later.',
        });
        setIsLoading(false);
        return;
      }
      
      setStatus({ type: 'success', message: 'Fit Testing Results E-card sent successfully!' });
      
      // Reset form but keep issue date as today and auto-fill fitTester
      const defaultProfile = latestSolutionProfiles.find((profile) => profile.isDefault);
      const defaultSchoolProfile = latestSchoolProfiles.find((profile) => profile.isDefault);
      setFormData(createInitialFormData({
        fitTester: user?.name || '',
        solutionType: defaultProfile?.solutionType || getDefaultBaseSolutionType(),
        solutionOpenDate: defaultProfile?.solutionOpenDate || '',
        solutionExpirationDate: defaultProfile?.solutionExpirationDate || '',
        schoolsList: defaultSchoolProfile?.schoolName || getDefaultBaseSchool(),
      }));
      setSelectedSolutionOption(
        defaultProfile
          ? `${PROFILE_SOLUTION_OPTION_PREFIX}${defaultProfile.id}`
          : `${BASE_SOLUTION_OPTION_PREFIX}${getDefaultBaseSolutionType()}`
      );
      setSelectedSchoolOption(
        defaultSchoolProfile
          ? `${PROFILE_SCHOOL_OPTION_PREFIX}${defaultSchoolProfile.id}`
          : `${BASE_SCHOOL_OPTION_PREFIX}${getDefaultBaseSchool()}`
      );
      setSetSolutionProfileAsDefault(false);
      setSetSchoolProfileAsDefault(false);
      setFieldErrors({});
      setHasStrokes(false);
      setHasTesterStrokes(false);
      printedNameManuallyEdited.current = false; // Reset manual edit flag
      // Clear signature canvas
      if (signatureCanvasRef.current) {
        const ctx = signatureCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
      }
      // Clear tester signature canvas
      if (testerSignatureCanvasRef.current) {
        const ctx = testerSignatureCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, testerSignatureCanvasRef.current.width, testerSignatureCanvasRef.current.height);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setStatus({ 
        type: 'error', 
        message: 'Failed to send e-card. Please try again later.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    const defaultProfile = solutionProfiles.find((profile) => profile.isDefault);
    const defaultSchoolProfile = schoolProfiles.find((profile) => profile.isDefault);
    setFormData(createInitialFormData({
      fitTester: user?.name || '',
      solutionType: defaultProfile?.solutionType || getDefaultBaseSolutionType(),
      solutionOpenDate: defaultProfile?.solutionOpenDate || '',
      solutionExpirationDate: defaultProfile?.solutionExpirationDate || '',
      schoolsList: defaultSchoolProfile?.schoolName || getDefaultBaseSchool(),
    }));
    setSelectedSolutionOption(
      defaultProfile
        ? `${PROFILE_SOLUTION_OPTION_PREFIX}${defaultProfile.id}`
        : `${BASE_SOLUTION_OPTION_PREFIX}${getDefaultBaseSolutionType()}`
    );
    setSelectedSchoolOption(
      defaultSchoolProfile
        ? `${PROFILE_SCHOOL_OPTION_PREFIX}${defaultSchoolProfile.id}`
        : `${BASE_SCHOOL_OPTION_PREFIX}${getDefaultBaseSchool()}`
    );
    setSetSolutionProfileAsDefault(false);
    setSetSchoolProfileAsDefault(false);
    setStatus({ type: '', message: '' });
    printedNameManuallyEdited.current = false; // Reset manual edit flag
    setFieldErrors({});
    setHasStrokes(false);
    setHasTesterStrokes(false);
    // Clear signature canvas
    if (signatureCanvasRef.current) {
      const ctx = signatureCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
    }
    // Clear tester signature canvas
    if (testerSignatureCanvasRef.current) {
      const ctx = testerSignatureCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, testerSignatureCanvasRef.current.width, testerSignatureCanvasRef.current.height);
    }
  };

  return {
    formData,
    isLoading,
    status,
    fieldErrors,
    solutionTypeOptions,
    selectedSolutionOption,
    setSolutionProfileAsDefault,
    isLoadingSolutionProfiles,
    schoolOptions,
    selectedSchoolOption,
    setSchoolProfileAsDefault,
    isLoadingSchoolProfiles,
    hasStrokes,
    hasTesterStrokes,
    handleInputChange,
    handleSolutionOptionChange: (optionValue) => {
      setSetSolutionProfileAsDefault(false);
      applySolutionSelection(optionValue);
    },
    handleSchoolOptionChange: (optionValue) => {
      setSetSchoolProfileAsDefault(false);
      applySchoolSelection(optionValue);
    },
    setSetSolutionProfileAsDefault,
    setSetSchoolProfileAsDefault,
    isAddingNewSolutionProfile: selectedSolutionOption === NEW_SOLUTION_PROFILE_OPTION,
    isAddingNewSchoolProfile: selectedSchoolOption === NEW_SCHOOL_PROFILE_OPTION,
    handleSubmit,
    handleSignatureStroke,
    handleSignatureClear,
    handleTesterSignatureStroke,
    handleTesterSignatureClear,
    setSignatureCanvasRef,
    setTesterSignatureCanvasRef,
    resetForm,
  };
};
