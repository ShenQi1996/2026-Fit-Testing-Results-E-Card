import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserFitTests, deleteFitTest, updateFitTest, ensureFitTestVerification } from '../services/firebaseDb';
import { sendFitTestCard } from '../services/emailService';
import { calculateExpirationDate } from '../utils/dateUtils';
import { downloadFitTestPdf, previewFitTestPdf } from '../utils/pdfUtils';
import { downloadFitTestsCsv } from '../utils/csvUtils';
import { TEST_LOCATION_OPTIONS } from '../constants/fitTestOptions';
import {
  FILTER_ALL,
  getMonthKeyFromTest,
  parseIssueDate,
  getEcardFormDataFromTest,
} from '../components/results/resultsUtils';

export const useFitTestResults = () => {
  const { user } = useAuth();
  const [fitTests, setFitTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [indexError, setIndexError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [pdfLoading, setPdfLoading] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [monthFilter, setMonthFilter] = useState(FILTER_ALL);
  const [schoolFilter, setSchoolFilter] = useState(FILTER_ALL);
  const [locationFilter, setLocationFilter] = useState(FILTER_ALL);

  const loadFitTests = async () => {
    try {
      setLoading(true);
      setError('');
      setIndexError(null);
      const tests = await getUserFitTests(user.uid);
      setFitTests(tests);
    } catch (err) {
      console.error('Error loading fit tests:', err);

      if (err.message === 'FIREBASE_INDEX_REQUIRED') {
        setIndexError({
          url: err.indexUrl,
          originalError: err.originalError,
        });
        setError('');
      } else {
        setError('Failed to load test results. Please try again.');
        setIndexError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.uid) {
      loadFitTests();
    } else {
      setLoading(false);
      setError('You must be logged in to view test results.');
    }
  }, [user]);

  const monthOptions = useMemo(() => {
    const map = new Map();
    fitTests.forEach((test) => {
      const dateToUse = parseIssueDate(test.issueDate) || (test.createdAt ? new Date(test.createdAt) : null);
      if (!dateToUse || isNaN(dateToUse.getTime())) return;
      const key = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, dateToUse.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [fitTests]);

  const schoolOptions = useMemo(() => {
    const schools = new Set();
    fitTests.forEach((test) => {
      const school = (test.schoolsList || '').trim();
      if (school) schools.add(school);
    });
    return Array.from(schools).sort((a, b) => a.localeCompare(b));
  }, [fitTests]);

  const locationOptions = useMemo(() => {
    const locations = new Set();
    fitTests.forEach((test) => {
      const location = (test.testLocation || '').trim();
      if (location) locations.add(location);
    });
    return Array.from(locations).sort((a, b) => a.localeCompare(b));
  }, [fitTests]);

  const filteredFitTests = useMemo(() => {
    return fitTests.filter((test) => {
      if (monthFilter !== FILTER_ALL) {
        const monthKey = getMonthKeyFromTest(test);
        if (monthKey !== monthFilter) return false;
      }

      if (schoolFilter !== FILTER_ALL) {
        if ((test.schoolsList || '').trim() !== schoolFilter) return false;
      }

      if (locationFilter !== FILTER_ALL) {
        if ((test.testLocation || '').trim() !== locationFilter) return false;
      }

      return true;
    });
  }, [fitTests, monthFilter, schoolFilter, locationFilter]);

  const flashMessage = (setter, message, ms = 3000) => {
    setter(message);
    setTimeout(() => setter(''), ms);
  };

  const buildExportFilenamePrefix = () => {
    const parts = ['fit-tests'];
    if (monthFilter !== FILTER_ALL) parts.push(monthFilter);
    if (schoolFilter !== FILTER_ALL) {
      parts.push(schoolFilter.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
    if (locationFilter !== FILTER_ALL) {
      parts.push(locationFilter.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
    return parts.filter(Boolean).join('-');
  };

  const handleExportCsv = () => {
    try {
      setExportingCsv(true);
      setError('');
      const filename = downloadFitTestsCsv(filteredFitTests, buildExportFilenamePrefix());
      setSuccessMessage(
        `Exported ${filteredFitTests.length} result${filteredFitTests.length === 1 ? '' : 's'} to ${filename}.`
      );
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setError(err.message || 'Failed to export CSV. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  const toggleCardExpansion = (testId) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const isCardExpanded = (testId) => expandedCards.has(testId);

  const handleDeleteClick = (testId, clientName) => {
    setDeleteConfirm({ id: testId, clientName: clientName || 'this record' });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      setSuccessMessage('');
      setError('');

      if (!user || !user.uid) {
        throw new Error('User must be logged in to delete records.');
      }
      await deleteFitTest(deleteConfirm.id, user.uid);

      setFitTests((prev) => prev.filter((test) => test.id !== deleteConfirm.id));
      setSuccessMessage(`Fit test record for "${deleteConfirm.clientName}" has been deleted successfully.`);
      setDeleteConfirm(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error deleting fit test:', err);
      setError('Failed to delete fit test record. Please try again.');
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const resolveCardFormData = async (test) => {
    let record = test;
    try {
      record = await ensureFitTestVerification(test, user?.uid);
      if (record?.verificationToken && record.verificationToken !== test.verificationToken) {
        setFitTests((prev) =>
          prev.map((item) =>
            item.id === test.id
              ? { ...item, verificationToken: record.verificationToken }
              : item
          )
        );
      }
    } catch (err) {
      console.error('Could not attach verification token:', err);
    }
    return getEcardFormDataFromTest(record);
  };

  const handlePreviewResultPdf = async (test) => {
    if (!test.clientName?.trim()) {
      flashMessage(setError, 'Cannot preview PDF: client name is missing for this record.', 4000);
      return;
    }
    try {
      setPdfLoading({ id: test.id, action: 'preview' });
      setError('');
      await previewFitTestPdf(await resolveCardFormData(test));
    } catch (err) {
      console.error('Error previewing PDF:', err);
      flashMessage(setError, err.message || 'Failed to generate PDF preview. Please try again.', 5000);
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadResultPdf = async (test) => {
    if (!test.clientName?.trim()) {
      flashMessage(setError, 'Cannot download PDF: client name is missing for this record.', 4000);
      return;
    }
    try {
      setPdfLoading({ id: test.id, action: 'download' });
      setError('');
      await downloadFitTestPdf(await resolveCardFormData(test));
    } catch (err) {
      console.error('Error downloading PDF:', err);
      flashMessage(setError, err.message || 'Failed to download PDF. Please try again.', 5000);
    } finally {
      setPdfLoading(null);
    }
  };

  const handleResend = async (test) => {
    if (!test.recipientEmail) {
      flashMessage(setError, 'Cannot resend: No recipient email found for this record.');
      return;
    }

    try {
      setResending(test.id);
      setSuccessMessage('');
      setError('');
      await sendFitTestCard(await resolveCardFormData(test));
      flashMessage(setSuccessMessage, `E-card resent successfully to ${test.recipientEmail}!`);
    } catch (err) {
      console.error('Error resending e-card:', err);
      flashMessage(setError, err.message || 'Failed to resend e-card. Please try again.', 5000);
    } finally {
      setResending(null);
    }
  };

  const handleEditClick = (test) => {
    setEditing(test.id);
    setEditData({
      recipientEmail: test.recipientEmail || '',
      clientName: test.clientName || '',
      dob: test.dob || '',
      testLocation: test.testLocation || '',
      issueDate: test.issueDate || '',
      fitTestType: test.fitTestType || '',
      respiratorMfg: test.respiratorMfg || '',
      testingAgent: test.testingAgent || '',
      maskSize: test.maskSize || '',
      model: test.model || '',
      result: test.result || '',
      fitTester: test.fitTester || '',
    });
  };

  const handleEditCancel = () => {
    setEditing(null);
    setEditData({});
  };

  const handleEditChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditSave = async (testId) => {
    const nextLocation = (editData.testLocation || '').trim();
    if (!nextLocation || nextLocation === 'Other') {
      flashMessage(setError, 'Please select or enter a test location before saving.', 4000);
      return;
    }

    try {
      setSaving(true);
      setSuccessMessage('');
      setError('');

      const updates = { ...editData };
      updates.testLocation = nextLocation;
      if (editData.issueDate) {
        updates.expirationDate = calculateExpirationDate(editData.issueDate);
      }

      if (!user || !user.uid) {
        throw new Error('User must be logged in to update records.');
      }
      await updateFitTest(testId, updates, user.uid);

      setFitTests((prev) => prev.map((test) =>
        test.id === testId ? { ...test, ...updates } : test
      ));

      setSuccessMessage('Record updated successfully!');
      setEditing(null);
      setEditData({});
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating fit test:', err);
      flashMessage(setError, err.message || 'Failed to update record. Please try again.', 5000);
    } finally {
      setSaving(false);
    }
  };

  const isCustomEditLocation =
    editData.testLocation &&
    !TEST_LOCATION_OPTIONS.some((opt) => opt.value === editData.testLocation);

  return {
    user,
    fitTests,
    loading,
    error,
    indexError,
    deleteConfirm,
    deleting,
    resending,
    editing,
    editData,
    saving,
    successMessage,
    pdfLoading,
    exportingCsv,
    monthFilter,
    setMonthFilter,
    schoolFilter,
    setSchoolFilter,
    locationFilter,
    setLocationFilter,
    monthOptions,
    schoolOptions,
    locationOptions,
    filteredFitTests,
    loadFitTests,
    handleExportCsv,
    toggleCardExpansion,
    isCardExpanded,
    handleDeleteClick,
    handleDeleteCancel,
    handleDeleteConfirm,
    handlePreviewResultPdf,
    handleDownloadResultPdf,
    handleResend,
    handleEditClick,
    handleEditCancel,
    handleEditChange,
    handleEditSave,
    isCustomEditLocation,
  };
};
