import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { calculateExpirationDate } from '../utils/dateUtils';
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
import { createInitialFormData } from '../constants/initialFitTestForm';
import { createVerificationToken } from '../utils/verificationToken';
import { useSelectableProfiles } from './useSelectableProfiles';

const NEW_SOLUTION_PROFILE_OPTION = '__new_solution_profile__';
const BASE_SOLUTION_OPTION_PREFIX = 'base:';
const PROFILE_SOLUTION_OPTION_PREFIX = 'profile:';
const NEW_SCHOOL_PROFILE_OPTION = '__new_school_profile__';
const BASE_SCHOOL_OPTION_PREFIX = 'school-base:';
const PROFILE_SCHOOL_OPTION_PREFIX = 'school-profile:';

const getDefaultBaseSolutionType = () => TESTING_AGENT_OPTIONS[0]?.value || '';
const getDefaultBaseSchool = () => SCHOOLS_OPTIONS[0]?.value || '';

const SOLUTION_EMPTY_FIELDS = {
  solutionType: '',
  solutionOpenDate: '',
  solutionExpirationDate: '',
};

const SCHOOL_EMPTY_FIELDS = {
  schoolsList: '',
};

const fieldsFromSolutionBase = (baseValue) => ({ solutionType: baseValue });
const fieldsFromSolutionProfile = (profile) => ({
  solutionType: profile.solutionType || getDefaultBaseSolutionType(),
  solutionOpenDate: profile.solutionOpenDate || '',
  solutionExpirationDate: profile.solutionExpirationDate || '',
});
const fieldsFromSchoolBase = (baseValue) => ({ schoolsList: baseValue });
const fieldsFromSchoolProfile = (profile) => ({
  schoolsList: profile.schoolName || '',
});

const buildSolutionSavedLabel = (profile) =>
  `Saved: ${profile.solutionType} | Open: ${profile.solutionOpenDate} | Exp: ${profile.solutionExpirationDate}${profile.isDefault ? ' (Default)' : ''}`;

const buildSchoolSavedLabel = (profile) =>
  `Saved: ${profile.schoolName}${profile.isDefault ? ' (Default)' : ''}`;

const formatSolutionBaseLabel = (option) => `Base: ${option.label}`;
const formatSchoolBaseLabel = (option) => option.label;

const clearSignatureCanvas = (canvas) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const captureSignatureDataUrl = (canvas) => (canvas ? canvas.toDataURL('image/png') : '');

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

  const solutionProfilesState = useSelectableProfiles({
    userId: user?.uid,
    newOptionValue: NEW_SOLUTION_PROFILE_OPTION,
    basePrefix: BASE_SOLUTION_OPTION_PREFIX,
    profilePrefix: PROFILE_SOLUTION_OPTION_PREFIX,
    baseOptions: TESTING_AGENT_OPTIONS,
    getDefaultBaseValue: getDefaultBaseSolutionType,
    fetchProfiles: getUserSolutionProfiles,
    buildSavedLabel: buildSolutionSavedLabel,
    formatBaseLabel: formatSolutionBaseLabel,
    newOptionLabel: '+ Add new solution profile',
    emptyFormFields: SOLUTION_EMPTY_FIELDS,
    fieldsFromBase: fieldsFromSolutionBase,
    fieldsFromProfile: fieldsFromSolutionProfile,
    setFormData,
    setStatus,
    loadWarning: 'Could not load saved solution profiles.',
    applyBaseWhenNoDefault: false,
  });

  const schoolProfilesState = useSelectableProfiles({
    userId: user?.uid,
    newOptionValue: NEW_SCHOOL_PROFILE_OPTION,
    basePrefix: BASE_SCHOOL_OPTION_PREFIX,
    profilePrefix: PROFILE_SCHOOL_OPTION_PREFIX,
    baseOptions: SCHOOLS_OPTIONS,
    getDefaultBaseValue: getDefaultBaseSchool,
    fetchProfiles: getUserSchoolProfiles,
    buildSavedLabel: buildSchoolSavedLabel,
    formatBaseLabel: formatSchoolBaseLabel,
    newOptionLabel: 'Other / Add new school',
    emptyFormFields: SCHOOL_EMPTY_FIELDS,
    fieldsFromBase: fieldsFromSchoolBase,
    fieldsFromProfile: fieldsFromSchoolProfile,
    setFormData,
    setStatus,
    loadWarning: 'Could not load saved school profiles.',
    applyBaseWhenNoDefault: true,
  });

  useEffect(() => {
    if (user && user.name) {
      setFormData((prev) => ({
        ...prev,
        fitTester: user.name,
      }));
    }
  }, [user]);

  const handleInputChange = (field, value) => {
    if (field === 'fitTester' || field === 'fitTestMethod') {
      return;
    }

    setFormData((prev) => {
      const updates = {
        ...prev,
        [field]: value,
      };

      if (field === 'clientName' && !printedNameManuallyEdited.current) {
        const prevPrintedName = (prev.printedName || '').trim();
        const prevClientName = (prev.clientName || '').trim();

        if (prevPrintedName === prevClientName || prevPrintedName === '') {
          updates.printedName = value.trim();
        }
      }

      return updates;
    });

    if (field === 'printedName') {
      if (value.trim() !== formData.clientName?.trim()) {
        printedNameManuallyEdited.current = true;
      } else {
        printedNameManuallyEdited.current = false;
      }
    }

    if (field === 'clientName') {
      if (!value || value.trim() === '') {
        printedNameManuallyEdited.current = false;
      } else if (formData.printedName === value.trim()) {
        printedNameManuallyEdited.current = false;
      }
    }

    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field === 'clientName' && !printedNameManuallyEdited.current && fieldErrors.printedName) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.printedName;
        return newErrors;
      });
    }
  };

  const clearFieldError = (field) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSignatureStroke = (hasStrokesValue) => {
    setHasStrokes(hasStrokesValue);
    clearFieldError('signature');
  };

  const handleSignatureClear = () => {
    setHasStrokes(false);
  };

  const handleTesterSignatureStroke = (hasStrokesValue) => {
    setHasTesterStrokes(hasStrokesValue);
    clearFieldError('testerSignature');
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

  const applyDefaultSelections = (latestSolutionProfiles, latestSchoolProfiles, extraFormFields = {}) => {
    const defaultProfile = latestSolutionProfiles.find((profile) => profile.isDefault);
    const defaultSchoolProfile = latestSchoolProfiles.find((profile) => profile.isDefault);

    setFormData(createInitialFormData({
      fitTester: user?.name || '',
      solutionType: defaultProfile?.solutionType || getDefaultBaseSolutionType(),
      solutionOpenDate: defaultProfile?.solutionOpenDate || '',
      solutionExpirationDate: defaultProfile?.solutionExpirationDate || '',
      schoolsList: defaultSchoolProfile?.schoolName || getDefaultBaseSchool(),
      ...extraFormFields,
    }));
    solutionProfilesState.setSelectedOption(
      defaultProfile
        ? `${PROFILE_SOLUTION_OPTION_PREFIX}${defaultProfile.id}`
        : `${BASE_SOLUTION_OPTION_PREFIX}${getDefaultBaseSolutionType()}`
    );
    schoolProfilesState.setSelectedOption(
      defaultSchoolProfile
        ? `${PROFILE_SCHOOL_OPTION_PREFIX}${defaultSchoolProfile.id}`
        : `${BASE_SCHOOL_OPTION_PREFIX}${getDefaultBaseSchool()}`
    );
    solutionProfilesState.setSetAsDefault(false);
    schoolProfilesState.setSetAsDefault(false);
    printedNameManuallyEdited.current = false;
    setFieldErrors({});
    setHasStrokes(false);
    setHasTesterStrokes(false);
    clearSignatureCanvas(signatureCanvasRef.current);
    clearSignatureCanvas(testerSignatureCanvasRef.current);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const shouldSaveProfile = solutionProfilesState.isAddingNew;
    const shouldSaveSchoolProfile = schoolProfilesState.isAddingNew;

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

    const validation = validateFitTestForm(formData, hasStrokes, hasTesterStrokes);
    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      setStatus({ type: 'error', message: validation.error });
      return;
    }

    setIsLoading(true);
    setStatus({ type: '', message: '' });

    try {
      let latestSolutionProfiles = solutionProfilesState.profiles;
      let latestSchoolProfiles = schoolProfilesState.profiles;

      if (user?.uid) {
        if (shouldSaveProfile) {
          const savedProfileId = await saveUserSolutionProfile(
            user.uid,
            {
              solutionType: formData.solutionType,
              solutionOpenDate: formData.solutionOpenDate,
              solutionExpirationDate: formData.solutionExpirationDate,
            },
            solutionProfilesState.setAsDefault
          );

          const refreshedProfiles = await solutionProfilesState.loadProfiles(user.uid);
          latestSolutionProfiles = refreshedProfiles;
          solutionProfilesState.applySelection(
            `${PROFILE_SOLUTION_OPTION_PREFIX}${savedProfileId}`,
            refreshedProfiles
          );
        }

        if (shouldSaveSchoolProfile) {
          const savedSchoolProfileId = await saveUserSchoolProfile(
            user.uid,
            { schoolName: formData.schoolsList },
            schoolProfilesState.setAsDefault
          );

          const refreshedSchoolProfiles = await schoolProfilesState.loadProfiles(user.uid);
          latestSchoolProfiles = refreshedSchoolProfiles;
          schoolProfilesState.applySelection(
            `${PROFILE_SCHOOL_OPTION_PREFIX}${savedSchoolProfileId}`,
            refreshedSchoolProfiles
          );
        }
      }

      const showFailureReasonUI =
        formData.facialHairInterfering === true || formData.respiratorDonnedCorrectly === false;
      const cleanedFormData = {
        ...formData,
        printedName: formData.printedName.trim(),
        testLocation: formData.testLocation?.trim() || '',
        fitTester: user?.name || formData.fitTester || '',
        fitTestMethod: 'Locked to Qualitative',
        failureReason: showFailureReasonUI ? formData.failureReason : '',
        correctiveActionNote: showFailureReasonUI ? formData.correctiveActionNote : '',
        testerMedicalRestrictionsNote: formData.testerMedicalRestrictionsReceived === true
          ? (formData.testerMedicalRestrictionsNote || '').trim()
          : '',
      };

      const expirationDate = calculateExpirationDate(cleanedFormData.issueDate);
      const formDataWithSignature = {
        ...cleanedFormData,
        signatureDataUrl: captureSignatureDataUrl(signatureCanvasRef.current),
        testerSignatureDataUrl: captureSignatureDataUrl(testerSignatureCanvasRef.current),
        expirationDate,
        verificationToken: cleanedFormData.verificationToken || createVerificationToken(),
      };

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
      applyDefaultSelections(latestSolutionProfiles, latestSchoolProfiles);
    } catch (error) {
      console.error('Error sending email:', error);
      setStatus({
        type: 'error',
        message: 'Failed to send e-card. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    applyDefaultSelections(solutionProfilesState.profiles, schoolProfilesState.profiles);
    setStatus({ type: '', message: '' });
  };

  return {
    formData,
    isLoading,
    status,
    fieldErrors,
    solutionTypeOptions: solutionProfilesState.options,
    selectedSolutionOption: solutionProfilesState.selectedOption,
    setSolutionProfileAsDefault: solutionProfilesState.setAsDefault,
    isLoadingSolutionProfiles: solutionProfilesState.isLoading,
    schoolOptions: schoolProfilesState.options,
    selectedSchoolOption: schoolProfilesState.selectedOption,
    setSchoolProfileAsDefault: schoolProfilesState.setAsDefault,
    isLoadingSchoolProfiles: schoolProfilesState.isLoading,
    hasStrokes,
    hasTesterStrokes,
    handleInputChange,
    handleSolutionOptionChange: solutionProfilesState.handleOptionChange,
    handleSchoolOptionChange: schoolProfilesState.handleOptionChange,
    setSetSolutionProfileAsDefault: solutionProfilesState.setSetAsDefault,
    setSetSchoolProfileAsDefault: schoolProfilesState.setSetAsDefault,
    isAddingNewSolutionProfile: solutionProfilesState.isAddingNew,
    isAddingNewSchoolProfile: schoolProfilesState.isAddingNew,
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
