import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTodayDate, calculateExpirationDate } from '../utils/dateUtils';
import { validateFitTestForm } from '../utils/validators';
import { sendFitTestCard } from '../services/emailService';
import { saveFitTest } from '../services/firebaseDb';

const INITIAL_FORM_DATA = {
  recipientEmail: '',
  clientName: '',
  dob: '',
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
  schoolsList: '',
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
  solutionType: '',
  solutionOpenDate: '',
  solutionExpirationDate: '',
  cleaningMethod: '',
  hoodCleaned: true, // Default checked
  nebulizerCleaned: true, // Default checked
  // Consent section
  studentClearanceConfirmed: false, // Default unchecked
  // Tester attestation checkboxes
  testerAttestationProtocolFollowed: true, // Default checked
  testerAttestationMedicalClearanceVerified: true, // Default checked
  testerAttestationRespiratorMatchesRecord: true, // Default checked
};

export const useFitTestForm = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasStrokes, setHasStrokes] = useState(false);
  const [hasTesterStrokes, setHasTesterStrokes] = useState(false);
  const signatureCanvasRef = useRef(null);
  const testerSignatureCanvasRef = useRef(null);
  const printedNameManuallyEdited = useRef(false);

  // Always set fitTester to logged-in user's name (read-only field)
  useEffect(() => {
    if (user && user.name) {
      setFormData(prev => ({
        ...prev,
        fitTester: user.name
      }));
    }
  }, [user]);

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
        // Always set fitTester to logged-in user's name (read-only field)
        fitTester: user?.name || formData.fitTester || '',
        // Always set fitTestMethod to Locked to Qualitative (locked field)
        fitTestMethod: 'Locked to Qualitative',
        // Clear failure reason fields if UI is not visible
        failureReason: showFailureReasonUI ? formData.failureReason : '',
        correctiveActionNote: showFailureReasonUI ? formData.correctiveActionNote : '',
      };
      
      // Calculate expiration date (test date + 1 year)
      const expirationDate = calculateExpirationDate(cleanedFormData.issueDate);
      
      const formDataWithSignature = {
        ...cleanedFormData,
        signatureDataUrl,
        testerSignatureDataUrl,
        expirationDate, // Add expiration date (issueDate + 1 year)
      };
      
      console.log('Submitting with signatureDataUrl:', signatureDataUrl ? 'Present' : 'Missing');
      // Step 1: Send email via EmailJS first
      await sendFitTestCard(formDataWithSignature);
      
      // Step 2: If email sent successfully, save record to Firebase Firestore
      if (user && user.uid) {
        try {
          await saveFitTest(user.uid, formDataWithSignature);
          console.log('Fit test record saved to Firebase');
        } catch (dbError) {
          console.error('Error saving to database:', dbError);
          // Email was sent but DB save failed - show warning
          setStatus({ 
            type: 'warning', 
            message: 'E-card sent successfully, but failed to save record to database. Please try again.' 
          });
          setIsLoading(false);
          return;
        }
      } else {
        console.warn('User not logged in, skipping database save');
      }
      
      setStatus({ type: 'success', message: 'Fit Testing Results E-card sent successfully!' });
      
      // Reset form but keep issue date as today and auto-fill fitTester
      setFormData({
        ...INITIAL_FORM_DATA,
        issueDate: getTodayDate(),
        fitTester: user?.name || '',
      });
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
    setFormData({
      ...INITIAL_FORM_DATA,
      issueDate: getTodayDate(),
      fitTester: user?.name || '',
    });
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
    hasStrokes,
    hasTesterStrokes,
    handleInputChange,
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
