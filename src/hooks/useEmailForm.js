import { useState, useEffect } from 'react';
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
};

export const useEmailForm = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validation = validateFitTestForm(formData);
    if (!validation.isValid) {
      setStatus({ type: 'error', message: validation.error });
      return;
    }

    setIsLoading(true);
    setStatus({ type: '', message: '' });

    try {
      // Step 1: Send email via EmailJS first
      await sendFitTestCard(formData);
      
      // Step 2: If email sent successfully, save record to Firebase Firestore
      if (user && user.uid) {
        try {
          await saveFitTest(user.uid, formData);
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
  };

  return {
    formData,
    isLoading,
    status,
    fieldErrors,
    handleInputChange,
    handleSubmit,
    resetForm,
  };
};

