import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTodayDate } from '../utils/dateUtils';
import { validateFitTestForm } from '../utils/validators';
import { sendFitTestCard } from '../services/emailService';
import { saveFitTest } from '../services/firebaseDb';

const INITIAL_FORM_DATA = {
  recipientEmail: '',
  clientName: '',
  dob: '',
  issueDate: getTodayDate(),
  fitTestType: 'N95',
  respiratorMfg: '3M',
  testingAgent: 'Bitrex',
  maskSize: 'Regular',
  model: '',
  result: 'Pass',
  fitTester: '',
  printedName: '', 
};

export const useEmailForm = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasStrokes, setHasStrokes] = useState(false);
  const signatureCanvasRef = useRef(null);

  // Auto-fill fitTester with user's name when user is available
  useEffect(() => {
    if (user && user.name) {
      setFormData(prev => {
        // Only set if fitTester is empty
        if (!prev.fitTester) {
          return {
            ...prev,
            fitTester: user.name
          };
        }
        return prev;
      });
    }
  }, [user]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
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

  const setSignatureCanvasRef = (ref) => {
    signatureCanvasRef.current = ref;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validation = validateFitTestForm(formData, hasStrokes);
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
      // Prepare form data with signature
      const formDataWithSignature = {
        ...formData,
        printedName: formData.printedName.trim(),
        signatureDataUrl,
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
      // Clear signature canvas
      if (signatureCanvasRef.current) {
        const ctx = signatureCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
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
    setFieldErrors({});
    setHasStrokes(false);
    // Clear signature canvas
    if (signatureCanvasRef.current) {
      const ctx = signatureCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
    }
  };

  return {
    formData,
    isLoading,
    status,
    fieldErrors,
    hasStrokes,
    handleInputChange,
    handleSubmit,
    handleSignatureStroke,
    handleSignatureClear,
    setSignatureCanvasRef,
    resetForm,
  };
};