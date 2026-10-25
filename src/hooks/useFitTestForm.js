import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { calculateExpirationDate } from '../utils/dateUtils';
import { validateFitTestForm } from '../utils/validators';
import { sendFitTestCard } from '../services/emailService';
import { getLastStaffSendAt, recordStaffSend } from '../services/emailSendLog';
import {
  evaluateStaffSendLimit,
  formatStaffSendLimitMessage,
  isRateLimitedSender,
} from '../utils/emailSendLimit';
import {
  saveFitTest,
  getUserSolutionProfiles,
  saveUserSolutionProfile,
} from '../services/firebaseDb';
import { getMasterSchoolRecord, listMasterSchoolRecords } from '../services/masterSchools';
import { TESTING_AGENT_OPTIONS } from '../constants/fitTestOptions';
import { isSuperAdmin } from '../utils/roles';
import {
  SELECT_SCHOOL_MESSAGE,
  ecardSchoolChoices,
  schoolsForSignedInUser,
} from '../utils/ecardSchools';
import { programAdminForSchool } from '../utils/programAdmin';
import { createInitialFormData } from '../constants/initialFitTestForm';
import { createVerificationToken } from '../utils/verificationToken';
import { useSelectableProfiles } from './useSelectableProfiles';

const NEW_SOLUTION_PROFILE_OPTION = '__new_solution_profile__';
const BASE_SOLUTION_OPTION_PREFIX = 'base:';
const PROFILE_SOLUTION_OPTION_PREFIX = 'profile:';

const getDefaultBaseSolutionType = () => TESTING_AGENT_OPTIONS[0]?.value || '';

const SOLUTION_EMPTY_FIELDS = {
  solutionType: '',
  solutionOpenDate: '',
  solutionExpirationDate: '',
};

const fieldsFromSolutionBase = (baseValue) => ({ solutionType: baseValue });
const fieldsFromSolutionProfile = (profile) => ({
  solutionType: profile.solutionType || getDefaultBaseSolutionType(),
  solutionOpenDate: profile.solutionOpenDate || '',
  solutionExpirationDate: profile.solutionExpirationDate || '',
});
const buildSolutionSavedLabel = (profile) =>
  `Saved: ${profile.solutionType} | Open: ${profile.solutionOpenDate} | Exp: ${profile.solutionExpirationDate}${profile.isDefault ? ' (Default)' : ''}`;

const formatSolutionBaseLabel = (option) => `Base: ${option.label}`;

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

  const [masterSchools, setMasterSchools] = useState([]);
  const [schoolRecords, setSchoolRecords] = useState([]);
  const [masterSchoolsLoading, setMasterSchoolsLoading] = useState(true);
  const superAdmin = isSuperAdmin(user?.role);
  const schoolChoice = useMemo(
    () => ecardSchoolChoices(user, masterSchools),
    [user, masterSchools],
  );
  const allowedSchools = schoolChoice.options;

  useEffect(() => {
    if (!user?.uid) {
      setMasterSchools([]);
      setSchoolRecords([]);
      setMasterSchoolsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setMasterSchoolsLoading(true);
    const loadRecords = superAdmin
      ? listMasterSchoolRecords()
      : Promise.all(schoolsForSignedInUser(user, []).map((name) => getMasterSchoolRecord(name)));
    loadRecords
      .then((records) => {
        if (cancelled) return;
        setSchoolRecords(records);
        setMasterSchools(superAdmin ? records.map((record) => record.name) : []);
      })
      .catch((error) => {
        console.error('Could not load schools', error);
        if (!cancelled) {
          setSchoolRecords([]);
          setMasterSchools([]);
        }
      })
      .finally(() => {
        if (!cancelled) setMasterSchoolsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [superAdmin, user]);

  useEffect(() => {
    setFormData((prev) => {
      const current = (prev.schoolsList || '').trim();
      const next = allowedSchools.length === 1
        ? allowedSchools[0]
        : (allowedSchools.includes(current) ? current : '');
      if (next === prev.schoolsList) return prev;
      return { ...prev, schoolsList: next };
    });
  }, [allowedSchools]);

  useEffect(() => {
    const chosen = (formData.schoolsList || '').trim();
    const next = programAdminForSchool(
      schoolRecords.find((record) => record.name === chosen),
      user,
    );
    setFormData((prev) => {
      if (
        prev.programAdministratorName === next.programAdministratorName
        && prev.programAdministratorContact === next.programAdministratorContact
      ) {
        return prev;
      }
      return { ...prev, ...next };
    });
  }, [formData.schoolsList, schoolRecords, user]);

  useEffect(() => {
    if (user && user.name) {
      setFormData((prev) => ({
        ...prev,
        fitTester: user.name,
      }));
    }
  }, [user]);

  const handleInputChange = (field, value) => {
    if (
      field === 'fitTester'
      || field === 'fitTestMethod'
      || field === 'programAdministratorName'
      || field === 'programAdministratorContact'
    ) {
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

  const applyDefaultSelections = (latestSolutionProfiles, extraFormFields = {}) => {
    const defaultProfile = latestSolutionProfiles.find((profile) => profile.isDefault);

    setFormData(createInitialFormData({
      fitTester: user?.name || '',
      solutionType: defaultProfile?.solutionType || getDefaultBaseSolutionType(),
      solutionOpenDate: defaultProfile?.solutionOpenDate || '',
      solutionExpirationDate: defaultProfile?.solutionExpirationDate || '',
      schoolsList: allowedSchools.length === 1 ? allowedSchools[0] : '',
      ...extraFormFields,
    }));
    solutionProfilesState.setSelectedOption(
      defaultProfile
        ? `${PROFILE_SOLUTION_OPTION_PREFIX}${defaultProfile.id}`
        : `${BASE_SOLUTION_OPTION_PREFIX}${getDefaultBaseSolutionType()}`
    );
    solutionProfilesState.setSetAsDefault(false);
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

    if (masterSchoolsLoading) {
      setStatus({ type: 'error', message: 'Schools are still loading. Please try again.' });
      return;
    }
    if (schoolChoice.blockedMessage) {
      setFieldErrors((prev) => ({ ...prev, schoolsList: schoolChoice.blockedMessage }));
      setStatus({ type: 'error', message: schoolChoice.blockedMessage });
      return;
    }
    const chosenSchool = (formData.schoolsList || '').trim();
    if (!allowedSchools.includes(chosenSchool)) {
      setFieldErrors((prev) => ({ ...prev, schoolsList: SELECT_SCHOOL_MESSAGE }));
      setStatus({ type: 'error', message: SELECT_SCHOOL_MESSAGE });
      return;
    }

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

    const validation = validateFitTestForm(formData, hasStrokes, hasTesterStrokes);
    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      setStatus({ type: 'error', message: validation.error });
      return;
    }

    setIsLoading(true);
    setStatus({ type: '', message: '' });

    try {
      if (user?.uid && isRateLimitedSender(user.email)) {
        let lastSentAt;
        try {
          lastSentAt = await getLastStaffSendAt(user.uid);
        } catch (limitError) {
          console.error('Error checking staff send limit:', limitError);
          setStatus({
            type: 'error',
            message: 'We could not check this account\'s daily send limit. Please try again in a moment.',
          });
          return;
        }
        const decision = evaluateStaffSendLimit({
          senderEmail: user.email,
          lastSentAt,
        });
        if (!decision.allowed) {
          setStatus({
            type: 'error',
            message: formatStaffSendLimitMessage(decision.retryAt),
          });
          return;
        }
      }

      let latestSolutionProfiles = solutionProfilesState.profiles;

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

      }

      const showFailureReasonUI =
        formData.facialHairInterfering === true || formData.respiratorDonnedCorrectly === false;
      const chosenForProgram = (formData.schoolsList || '').trim();
      const program = programAdminForSchool(
        schoolRecords.find((record) => record.name === chosenForProgram),
        user,
      );
      const cleanedFormData = {
        ...formData,
        ...program,
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
        const stagingBlocked = typeof emailError?.message === 'string'
          && emailError.message.startsWith('Staging does not email');
        setStatus({
          type: 'warning',
          message: stagingBlocked
            ? emailError.message
            : user?.uid
              ? 'Record saved, but the e-card email failed. You can resend it from Results.'
              : 'Failed to send e-card. Please try again later.',
        });
        setIsLoading(false);
        return;
      }

      if (user?.uid && isRateLimitedSender(user.email)) {
        try {
          await recordStaffSend(user.uid, user.email);
        } catch (logError) {
          console.error('Error recording staff send limit:', logError);
        }
      }

      setStatus({ type: 'success', message: 'Fit Testing Results E-card sent successfully!' });
      applyDefaultSelections(latestSolutionProfiles);
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

  const chosenSchool = (formData.schoolsList || '').trim();
  const schoolSubmitBlocked = masterSchoolsLoading
    || Boolean(schoolChoice.blockedMessage)
    || !allowedSchools.includes(chosenSchool);

  const handleSchoolOptionChange = (value) => {
    if (schoolChoice.locked) return;
    if (!allowedSchools.includes(value)) return;
    setFormData((prev) => ({ ...prev, schoolsList: value }));
    clearFieldError('schoolsList');
  };

  const resetForm = () => {
    applyDefaultSelections(solutionProfilesState.profiles);
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
    schoolOptions: allowedSchools.map((name) => ({ value: name, label: name })),
    selectedSchoolOption: formData.schoolsList || '',
    schoolLocked: schoolChoice.locked && allowedSchools.length === 1,
    schoolBlockedMessage: (superAdmin && masterSchoolsLoading) ? '' : schoolChoice.blockedMessage,
    schoolSubmitBlocked,
    isLoadingSchoolProfiles: masterSchoolsLoading,
    hasStrokes,
    hasTesterStrokes,
    handleInputChange,
    handleSolutionOptionChange: solutionProfilesState.handleOptionChange,
    handleSchoolOptionChange,
    setSetSolutionProfileAsDefault: solutionProfilesState.setSetAsDefault,
    isAddingNewSolutionProfile: solutionProfilesState.isAddingNew,
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
