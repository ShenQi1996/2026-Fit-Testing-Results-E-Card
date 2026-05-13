import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserFitTests, deleteFitTest, updateFitTest } from '../../services/firebaseDb';
import { sendFitTestCard } from '../../services/emailService';
import { formatDateInput, calculateExpirationDate } from '../../utils/dateUtils';
import { downloadFitTestPdf, previewFitTestPdf } from '../../utils/pdfUtils';
import './FitTestResults.css';

const FitTestResults = () => {
  const { user } = useAuth();
  const [fitTests, setFitTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [indexError, setIndexError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, clientName }
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(null); // testId that's being resent
  const [editing, setEditing] = useState(null); // testId that's being edited
  const [editData, setEditData] = useState({}); // Edited data for the test
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedCards, setExpandedCards] = useState(new Set()); // Track which cards are expanded
  const [pdfLoading, setPdfLoading] = useState(null); // { id, action: 'preview'|'download' } while generating PDF

  useEffect(() => {
    if (user && user.uid) {
      loadFitTests();
    } else {
      setLoading(false);
      setError('You must be logged in to view test results.');
    }
  }, [user]);

  const loadFitTests = async () => {
    try {
      setLoading(true);
      setError('');
      setIndexError(null);
      const tests = await getUserFitTests(user.uid);
      setFitTests(tests);
    } catch (err) {
      console.error('Error loading fit tests:', err);
      
      // Check if this is a Firebase index error
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateWithTime = (dateString, fallbackTimestamp = null) => {
    if (!dateString) return 'N/A';
    try {
      let date;
      
      // If dateString is in MM/DD/YYYY format, parse it
      if (dateString.includes('/') && dateString.split('/').length === 3) {
        const parts = dateString.split('/');
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        date = new Date(year, month, day);
        
        // If we have a fallback timestamp (like createdAt), use its time component
        if (fallbackTimestamp) {
          const fallbackDate = new Date(fallbackTimestamp);
          date.setHours(fallbackDate.getHours());
          date.setMinutes(fallbackDate.getMinutes());
          date.setSeconds(fallbackDate.getSeconds());
        }
      } else {
        // Try parsing as ISO string or other format
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  // Parse issueDate (format: MM/DD/YYYY)
  const parseIssueDate = (dateString) => {
    if (!dateString) return null;
    try {
      // Handle MM/DD/YYYY format
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      // Fallback to standard date parsing
      return new Date(dateString);
    } catch (error) {
      console.error('Error parsing issueDate:', error);
      return null;
    }
  };

  // Group fit tests by month/year based on issueDate
  const groupTestsByMonth = (tests) => {
    // First, sort all tests by issueDate (newest first)
    const sortedTests = [...tests].sort((a, b) => {
      const dateA = parseIssueDate(a.issueDate);
      const dateB = parseIssueDate(b.issueDate);
      
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // Put tests without issueDate at the end
      if (!dateB) return -1;
      
      return dateB - dateA; // Descending order (newest first)
    });

    const grouped = {};
    
    sortedTests.forEach((test) => {
      // Use issueDate for grouping, fallback to createdAt if issueDate is missing
      const dateToUse = parseIssueDate(test.issueDate) || (test.createdAt ? new Date(test.createdAt) : null);
      
      if (!dateToUse) return;
      
      try {
        const monthKey = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
        const monthName = dateToUse.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        if (!grouped[monthKey]) {
          grouped[monthKey] = {
            monthName,
            monthKey,
            year: dateToUse.getFullYear(),
            month: dateToUse.getMonth() + 1,
            tests: [],
          };
        }
        
        grouped[monthKey].tests.push(test);
      } catch (error) {
        console.error('Error grouping test:', error);
      }
    });
    
    // Sort months by date (newest first)
    return Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  };

  const groupedTests = groupTestsByMonth(fitTests);

  const toggleCardExpansion = (testId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  const isCardExpanded = (testId) => {
    return expandedCards.has(testId);
  };

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
      
      // Remove from local state
      setFitTests(prev => prev.filter(test => test.id !== deleteConfirm.id));
      
      setSuccessMessage(`Fit test record for "${deleteConfirm.clientName}" has been deleted successfully.`);
      setDeleteConfirm(null);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error deleting fit test:', err);
      setError('Failed to delete fit test record. Please try again.');
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const getEcardFormDataFromTest = (test) => ({
    recipientEmail: test.recipientEmail || '',
    clientName: test.clientName || '',
    dob: test.dob || '',
    issueDate: test.issueDate || '',
    fitTestType: test.fitTestType || '',
    respiratorMfg: test.respiratorMfg || '',
    testingAgent: test.testingAgent || '',
    maskSize: test.maskSize || '',
    model: test.model || '',
    result: test.result || '',
    fitTester: test.fitTester || '',
  });

  const handlePreviewResultPdf = async (test) => {
    if (!test.clientName?.trim()) {
      setError('Cannot preview PDF: client name is missing for this record.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    try {
      setPdfLoading({ id: test.id, action: 'preview' });
      setError('');
      await previewFitTestPdf(getEcardFormDataFromTest(test));
    } catch (err) {
      console.error('Error previewing PDF:', err);
      setError(err.message || 'Failed to generate PDF preview. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadResultPdf = async (test) => {
    if (!test.clientName?.trim()) {
      setError('Cannot download PDF: client name is missing for this record.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    try {
      setPdfLoading({ id: test.id, action: 'download' });
      setError('');
      await downloadFitTestPdf(getEcardFormDataFromTest(test));
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError(err.message || 'Failed to download PDF. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setPdfLoading(null);
    }
  };

  const handleResend = async (test) => {
    if (!test.recipientEmail) {
      setError('Cannot resend: No recipient email found for this record.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setResending(test.id);
      setSuccessMessage('');
      setError('');

      // Prepare form data from the CURRENT saved test record (uses latest data)
      const formData = getEcardFormDataFromTest(test);

      // Send email via EmailJS
      await sendFitTestCard(formData);
      
      // Note: Record updates are restricted to admin users only
      // Resending only sends the email, it doesn't modify the record
      
      setSuccessMessage(`E-card resent successfully to ${test.recipientEmail}!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error resending e-card:', err);
      setError(err.message || 'Failed to resend e-card. Please try again.');
      setTimeout(() => setError(''), 5000);
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
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditSave = async (testId) => {
    try {
      setSaving(true);
      setSuccessMessage('');
      setError('');

      // Recalculate expiration date if issueDate is being updated
      const updates = { ...editData };
      if (editData.issueDate) {
        updates.expirationDate = calculateExpirationDate(editData.issueDate);
      }

      // Update the record in Firebase
      if (!user || !user.uid) {
        throw new Error('User must be logged in to update records.');
      }
      await updateFitTest(testId, updates, user.uid);
      
      // Update local state
      setFitTests(prev => prev.map(test => 
        test.id === testId ? { ...test, ...updates } : test
      ));
      
      setSuccessMessage('Record updated successfully!');
      setEditing(null);
      setEditData({});
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error updating fit test:', err);
      setError(err.message || 'Failed to update record. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="test-results-container">
        <div className="test-results-content">
          <div className="loading-message">Loading test results...</div>
        </div>
      </div>
    );
  }

  if (indexError) {
    return (
      <div className="test-results-container">
        <div className="test-results-content">
          <div className="index-error-message">
            <h3>⚠️ Firebase Index Required</h3>
            <p>
              Firebase needs a composite index to query your fit test records. 
              This is a one-time setup.
            </p>
            <div className="index-instructions">
              <h4>How to create the index:</h4>
              <ol>
                <li>
                  {indexError.url ? (
                    <>
                      Click this link to create the index automatically:{' '}
                      <a 
                        href={indexError.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="index-link"
                      >
                        Create Index in Firebase Console
                      </a>
                    </>
                  ) : (
                    <>
                      Go to{' '}
                      <a 
                        href="https://console.firebase.google.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="index-link"
                      >
                        Firebase Console
                      </a>
                      {' '}and create a composite index for:
                      <ul>
                        <li><strong>Collection:</strong> fitTests</li>
                        <li><strong>Fields:</strong> userId (Ascending), createdAt (Descending)</li>
                      </ul>
                    </>
                  )}
                </li>
                <li>Wait for the index to build (usually takes 1-2 minutes)</li>
                <li>Click the "Retry" button below once the index is ready</li>
              </ol>
            </div>
            <button onClick={loadFitTests} className="retry-button">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="test-results-container">
        <div className="test-results-content">
          <div className="error-message">{error}</div>
          <button onClick={loadFitTests} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="test-results-container">
      <div className="test-results-content">
        <div className="results-header">
          <h2 className="results-title">Fit Test Results</h2>
          <button onClick={loadFitTests} className="refresh-button">
            🔄 Refresh
          </button>
        </div>

        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}

        {error && !indexError && (
          <div className="error-message-banner">
            {error}
          </div>
        )}

        {fitTests.length === 0 ? (
          <div className="empty-state">
            <p>No test results found.</p>
            <p>Start by sending your first fit test e-card!</p>
          </div>
        ) : (
          <div className="calendar-view">
            {groupedTests.map((monthGroup) => (
              <div key={monthGroup.monthKey} className="month-section">
                <div className="month-header">
                  <h3 className="month-title">{monthGroup.monthName}</h3>
                  <span className="month-count">{monthGroup.tests.length} {monthGroup.tests.length === 1 ? 'record' : 'records'}</span>
                </div>
                <div className="results-grid">
                  {monthGroup.tests.map((test) => (
                    <div key={test.id} className={`result-card ${editing === test.id ? 'editing' : ''}`}>
                      <div className="result-card-header">
                        {editing === test.id ? (
                          <input
                            type="text"
                            className="edit-input edit-client-name"
                            value={editData.clientName || ''}
                            onChange={(e) => handleEditChange('clientName', e.target.value)}
                            placeholder="Client Name"
                          />
                        ) : (
                          <h3 className="result-client-name">{test.clientName || 'N/A'}</h3>
                        )}
                        {editing === test.id ? (
                          <select
                            className="edit-select edit-result-badge"
                            value={editData.result || 'Pass'}
                            onChange={(e) => handleEditChange('result', e.target.value)}
                          >
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                          </select>
                        ) : (
                          <span className={`result-badge ${test.result === 'Pass' ? 'pass' : 'fail'}`}>
                            {test.result}
                          </span>
                        )}
                      </div>
                      {editing === test.id ? (
                        <div className="result-card-body edit-mode">
                          <div className="edit-form-row">
                            <label>Recipient Email:</label>
                            <input
                              type="email"
                              className="edit-input"
                              value={editData.recipientEmail || ''}
                              onChange={(e) => handleEditChange('recipientEmail', e.target.value)}
                              placeholder="Recipient email"
                            />
                          </div>
                          <div className="edit-form-row">
                            <label>Issue Date:</label>
                            <input
                              type="text"
                              className="edit-input"
                              value={editData.issueDate || ''}
                              onChange={(e) => handleEditChange('issueDate', e.target.value)}
                              placeholder="MM/DD/YYYY"
                            />
                          </div>
                          <div className="edit-form-row">
                            <label>Date of Birth:</label>
                            <input
                              type="text"
                              className="edit-input"
                              value={editData.dob || ''}
                              onChange={(e) => handleEditChange('dob', formatDateInput(e.target.value))}
                              placeholder="MM/DD/YYYY"
                              maxLength={10}
                            />
                          </div>
                          <div className="edit-form-row">
                            <label>Fit Test Type:</label>
                            <select
                              className="edit-select"
                              value={editData.fitTestType || 'N95'}
                              onChange={(e) => handleEditChange('fitTestType', e.target.value)}
                            >
                              <option value="N95">N95</option>
                              <option value="N99">N99</option>
                              <option value="N100">N100</option>
                              <option value="P100">P100</option>
                              <option value="Half Face">Half Face</option>
                              <option value="Full Face">Full Face</option>
                            </select>
                          </div>
                          <div className="edit-form-row">
                            <label>Respirator MFG:</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <select
                                className="edit-select"
                                value={
                                  editData.respiratorMfg && 
                                  !['3M', 'Honeywell', 'Moldex', 'Kimberly-Clark', 'Other'].includes(editData.respiratorMfg)
                                    ? 'Other' 
                                    : (editData.respiratorMfg || '3M')
                                }
                                onChange={(e) => {
                                  const selectedValue = e.target.value;
                                  if (selectedValue === 'Other') {
                                    handleEditChange('respiratorMfg', 'Other');
                                  } else {
                                    handleEditChange('respiratorMfg', selectedValue);
                                  }
                                }}
                              >
                                <option value="3M">3M</option>
                                <option value="Honeywell">Honeywell</option>
                                <option value="Moldex">Moldex</option>
                                <option value="Kimberly-Clark">Kimberly-Clark</option>
                                <option value="Other">Other</option>
                              </select>
                              {(
                                editData.respiratorMfg === 'Other' || 
                                (editData.respiratorMfg && !['3M', 'Honeywell', 'Moldex', 'Kimberly-Clark', 'Other'].includes(editData.respiratorMfg))
                              ) && (
                                <input
                                  type="text"
                                  className="edit-input"
                                  placeholder="Enter manufacturer name"
                                  value={
                                    editData.respiratorMfg && 
                                    !['3M', 'Honeywell', 'Moldex', 'Kimberly-Clark', 'Other'].includes(editData.respiratorMfg)
                                      ? editData.respiratorMfg 
                                      : ''
                                  }
                                  onChange={(e) => handleEditChange('respiratorMfg', e.target.value)}
                                />
                              )}
                            </div>
                          </div>
                          <div className="edit-form-row">
                            <label>Testing Agent:</label>
                            <select
                              className="edit-select"
                              value={editData.testingAgent || 'Bitrex'}
                              onChange={(e) => handleEditChange('testingAgent', e.target.value)}
                            >
                              <option value="Bitrex">Bitrex</option>
                              <option value="Saccharin">Saccharin</option>
                              <option value="Isoamyl Acetate">Isoamyl Acetate</option>
                            </select>
                          </div>
                          <div className="edit-form-row">
                            <label>Mask Size:</label>
                            <select
                              className="edit-select"
                              value={editData.maskSize || 'Regular'}
                              onChange={(e) => handleEditChange('maskSize', e.target.value)}
                            >
                              <option value="Small">Small</option>
                              <option value="Regular">Regular</option>
                              <option value="Large">Large</option>
                            </select>
                          </div>
                          <div className="edit-form-row">
                            <label>Model:</label>
                            <input
                              type="text"
                              className="edit-input"
                              value={editData.model || ''}
                              onChange={(e) => handleEditChange('model', e.target.value)}
                              placeholder="e.g., 1870+"
                            />
                          </div>
                          <div className="edit-form-row">
                            <label>Fit Tester:</label>
                            <input
                              type="text"
                              className="edit-input"
                              value={editData.fitTester || ''}
                              onChange={() => {}} // Read-only - cannot be changed
                              placeholder="Fit tester name"
                              disabled
                              style={{ opacity: 0.7, cursor: 'not-allowed' }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="result-card-body">
                          {/* Basic Information - Always Visible */}
                          <div className="result-section">
                            <h4 className="result-section-title">Basic Information</h4>
                            <div className="result-row">
                              <span className="result-label">Issue Date:</span>
                              <span className="result-value">
                                {test.issueDate ? formatDateWithTime(test.issueDate, test.createdAt) : 'N/A'}
                              </span>
                            </div>
                            {test.issueDate && (
                              <div className="result-row">
                                <span className="result-label">Fit test expiration date:</span>
                                <span className="result-value">
                                  {(() => {
                                    const expDate = test.expirationDate || calculateExpirationDate(test.issueDate);
                                    return expDate ? formatDateWithTime(expDate, test.createdAt) : 'N/A';
                                  })()}
                                </span>
                              </div>
                            )}
                            <div className="result-row">
                              <span className="result-label">Fit Test Type:</span>
                              <span className="result-value">{test.fitTestType || 'N/A'}</span>
                            </div>
                            {test.fitTestMethod && (
                              <div className="result-row">
                                <span className="result-label">Fit Test Method:</span>
                                <span className="result-value">{test.fitTestMethod}</span>
                              </div>
                            )}
                            <div className="result-row">
                              <span className="result-label">Fit Tester:</span>
                              <span className="result-value">{test.fitTester || 'N/A'}</span>
                            </div>
                            {test.recipientEmail && (
                              <div className="result-row">
                                <span className="result-label">Sent To:</span>
                                <span className="result-value">{test.recipientEmail}</span>
                              </div>
                            )}
                            <div className="result-row">
                              <span className="result-label">Created:</span>
                              <span className="result-value">{formatDate(test.createdAt)}</span>
                            </div>
                          </div>

                          {/* Collapsible Additional Information */}
                          {isCardExpanded(test.id) && (
                            <>
                          {/* Respirator Details */}
                          <div className="result-section">
                            <h4 className="result-section-title">Respirator Details</h4>
                            <div className="result-row">
                              <span className="result-label">Respirator MFG:</span>
                              <span className="result-value">{test.respiratorMfg || 'N/A'}</span>
                            </div>
                            <div className="result-row">
                              <span className="result-label">Testing Agent:</span>
                              <span className="result-value">{test.testingAgent || 'N/A'}</span>
                            </div>
                            <div className="result-row">
                              <span className="result-label">Mask Size:</span>
                              <span className="result-value">{test.maskSize || 'N/A'}</span>
                            </div>
                            {test.model && (
                              <div className="result-row">
                                <span className="result-label">Model:</span>
                                <span className="result-value">{test.model}</span>
                              </div>
                            )}
                          </div>

                          {/* Written Respiratory Protection Program */}
                          {(test.schoolsOnFile !== undefined || test.schoolsList || test.programAdministratorName || test.programAdministratorContact) && (
                            <div className="result-section">
                              <h4 className="result-section-title">Written Respiratory Protection Program</h4>
                              {test.schoolsOnFile !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Schools on file:</span>
                                  <span className="result-value">{test.schoolsOnFile ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                              {test.schoolsList && (
                                <div className="result-row">
                                  <span className="result-label">List of Schools Clients:</span>
                                  <span className="result-value">{test.schoolsList}</span>
                                </div>
                              )}
                              {test.programAdministratorName && (
                                <div className="result-row">
                                  <span className="result-label">Program Administrator Name:</span>
                                  <span className="result-value">{test.programAdministratorName}</span>
                                </div>
                              )}
                              {test.programAdministratorContact && (
                                <div className="result-row">
                                  <span className="result-label">Program Administrator Contact:</span>
                                  <span className="result-value">{test.programAdministratorContact}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Fit Test Invalidation Conditions */}
                          {(test.facialHairInterfering !== undefined || test.respiratorDonnedCorrectly !== undefined || test.employeeSealCheckInstructionProvided !== undefined || test.failureReason || test.correctiveActionNote) && (
                            <div className="result-section">
                              <h4 className="result-section-title">Fit Test Invalidation Conditions</h4>
                              {test.facialHairInterfering !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Facial hair interfering with seal:</span>
                                  <span className="result-value">{test.facialHairInterfering ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                              {test.respiratorDonnedCorrectly !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Respirator donned correctly confirmed:</span>
                                  <span className="result-value">{test.respiratorDonnedCorrectly ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                              {test.employeeSealCheckInstructionProvided !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Employee seal check instruction provided:</span>
                                  <span className="result-value">{test.employeeSealCheckInstructionProvided ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                              {(test.facialHairInterfering === true || test.respiratorDonnedCorrectly === false) && (
                                <>
                                  {test.failureReason && (
                                    <div className="result-row">
                                      <span className="result-label">Failure reason:</span>
                                      <span className="result-value">{test.failureReason}</span>
                                    </div>
                                  )}
                                  {test.correctiveActionNote && (
                                    <div className="result-row">
                                      <span className="result-label">Corrective action note:</span>
                                      <span className="result-value" style={{ whiteSpace: 'pre-wrap' }}>{test.correctiveActionNote}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {/* Sensitivity Screening */}
                          {(test.sensitivityScreeningPerformed !== undefined || test.sensitivityDetected !== undefined) && (
                            <div className="result-section">
                              <h4 className="result-section-title">Sensitivity Screening Documentation</h4>
                              {test.sensitivityScreeningPerformed !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Sensitivity screening performed:</span>
                                  <span className="result-value">{test.sensitivityScreeningPerformed ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                              {test.sensitivityDetected !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Sensitivity detected:</span>
                                  <span className="result-value">{test.sensitivityDetected ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Required Exercise Checklist */}
                          {(test.exerciseNormalBreathing !== undefined || test.exerciseDeepBreathing !== undefined || test.exerciseHeadSideToSide !== undefined || test.exerciseHeadUpAndDown !== undefined || test.exerciseTalking !== undefined || test.exerciseBendingOverOrJogging !== undefined || test.exerciseNormalBreathingAgain !== undefined) && (
                            <div className="result-section">
                              <h4 className="result-section-title">Required Exercise Checklist</h4>
                              {test.exerciseNormalBreathing !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Normal breathing:</span>
                                  <span className="result-value">{test.exerciseNormalBreathing ? '✓ Completed' : '✗ Not completed'}</span>
                                </div>
                              )}
                              {test.exerciseDeepBreathing !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Deep breathing:</span>
                                  <span className="result-value">{test.exerciseDeepBreathing ? '✓ Completed' : '✗ Not completed'}</span>
                                </div>
                              )}
                              {test.exerciseHeadSideToSide !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Head side to side:</span>
                                  <span className="result-value">{test.exerciseHeadSideToSide ? '✓ Completed' : '✗ Not completed'}</span>
                                </div>
                              )}
                              {test.exerciseHeadUpAndDown !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Head up and down:</span>
                                  <span className="result-value">{test.exerciseHeadUpAndDown ? '✓ Completed' : '✗ Not completed'}</span>
                                </div>
                              )}
                              {test.exerciseTalking !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Talking:</span>
                                  <span className="result-value">{test.exerciseTalking ? '✓ Completed' : '✗ Not completed'}</span>
                                </div>
                              )}
                              {test.exerciseBendingOverOrJogging !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Bending over or jogging in place:</span>
                                  <span className="result-value">{test.exerciseBendingOverOrJogging ? '✓ Completed' : '✗ Not completed'}</span>
                                </div>
                              )}
                              {test.exerciseNormalBreathingAgain !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Normal breathing again:</span>
                                  <span className="result-value">{test.exerciseNormalBreathingAgain ? '✓ Completed' : '✗ Not completed'}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Equipment Hygiene and Solution Control */}
                          {(test.solutionType || test.solutionOpenDate || test.solutionExpirationDate || test.cleaningMethod !== undefined || test.hoodCleaned !== undefined || test.nebulizerCleaned !== undefined) && (
                            <div className="result-section">
                              <h4 className="result-section-title">Equipment Hygiene and Solution Control</h4>
                              {test.solutionType && (
                                <div className="result-row">
                                  <span className="result-label">Solution type:</span>
                                  <span className="result-value">{test.solutionType}</span>
                                </div>
                              )}
                              {test.solutionOpenDate && (
                                <div className="result-row">
                                  <span className="result-label">Solution open date:</span>
                                  <span className="result-value">{test.solutionOpenDate}</span>
                                </div>
                              )}
                              {test.solutionExpirationDate && (
                                <div className="result-row">
                                  <span className="result-label">Solution expiration date:</span>
                                  <span className="result-value">{test.solutionExpirationDate}</span>
                                </div>
                              )}
                              {test.cleaningMethod && (
                                <div className="result-row">
                                  <span className="result-label">Cleaning method:</span>
                                  <span className="result-value">{test.cleaningMethod}</span>
                                </div>
                              )}
                              {(test.hoodCleaned !== undefined || test.nebulizerCleaned !== undefined) && (
                                <div className="result-subsection">
                                  <h5 className="result-subsection-title">Daily cleaning record</h5>
                                  {test.hoodCleaned !== undefined && (
                                    <div className="result-row">
                                      <span className="result-label">Hood cleaned:</span>
                                      <span className="result-value">{test.hoodCleaned ? 'Yes' : 'No'}</span>
                                    </div>
                                  )}
                                  {test.nebulizerCleaned !== undefined && (
                                    <div className="result-row">
                                      <span className="result-label">Nebulizer cleaned:</span>
                                      <span className="result-value">{test.nebulizerCleaned ? 'Yes' : 'No'}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Consent and Signatures */}
                          {(test.printedName || test.studentClearanceConfirmed !== undefined || test.signatureDataUrl || test.testerSignatureDataUrl || test.testerAttestationProtocolFollowed !== undefined || test.testerAttestationMedicalClearanceVerified !== undefined || test.testerAttestationRespiratorMatchesRecord !== undefined) && (
                            <div className="result-section">
                              <h4 className="result-section-title">Consent</h4>
                              {test.studentClearanceConfirmed !== undefined && (
                                <div className="result-row">
                                  <span className="result-label">Student clearance confirmed:</span>
                                  <span className="result-value">{test.studentClearanceConfirmed ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                              {test.printedName && (
                                <div className="result-row">
                                  <span className="result-label">Printed name:</span>
                                  <span className="result-value">{test.printedName}</span>
                                </div>
                              )}
                              {test.signatureDataUrl && (
                                <div className="signature-display-section">
                                  <div className="signature-display">
                                    <span className="result-label">Student Signature:</span>
                                    <div className="signature-image-container">
                                      <img 
                                        src={test.signatureDataUrl} 
                                        alt="Student Signature" 
                                        className="signature-image"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {test.testerSignatureDataUrl && (
                                <div className="signature-display-section">
                                  <div className="signature-display">
                                    <span className="result-label">Tester Signature:</span>
                                    <div className="signature-image-container">
                                      <img 
                                        src={test.testerSignatureDataUrl} 
                                        alt="Tester Signature" 
                                        className="signature-image"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {(test.testerAttestationProtocolFollowed !== undefined || test.testerAttestationMedicalClearanceVerified !== undefined || test.testerAttestationRespiratorMatchesRecord !== undefined) && (
                                <div className="result-subsection" style={{ marginTop: '16px' }}>
                                  <h5 className="result-subsection-title">Tester Attestation</h5>
                                  {test.testerAttestationProtocolFollowed !== undefined && (
                                    <div className="result-row">
                                      <span className="result-label">Protocol followed:</span>
                                      <span className="result-value">{test.testerAttestationProtocolFollowed ? 'Yes' : 'No'}</span>
                                    </div>
                                  )}
                                  {test.testerAttestationMedicalClearanceVerified !== undefined && (
                                    <div className="result-row">
                                      <span className="result-label">Medical clearance verified:</span>
                                      <span className="result-value">{test.testerAttestationMedicalClearanceVerified ? 'Yes' : 'No'}</span>
                                    </div>
                                  )}
                                  {test.testerAttestationRespiratorMatchesRecord !== undefined && (
                                    <div className="result-row">
                                      <span className="result-label">Respirator matches record:</span>
                                      <span className="result-value">{test.testerAttestationRespiratorMatchesRecord ? 'Yes' : 'No'}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                            </>
                          )}

                          {/* Show All / Show Less Button */}
                          <div style={{ marginTop: '16px', textAlign: 'center' }}>
                            <button
                              onClick={() => toggleCardExpansion(test.id)}
                              className="show-all-button"
                            >
                              {isCardExpanded(test.id) ? '▼ Show Less' : '▶ Show All'}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="result-card-footer">
                        {editing === test.id ? (
                          <>
                            <button
                              onClick={() => handleEditSave(test.id)}
                              className="save-button"
                              disabled={saving}
                            >
                              {saving ? 'Saving...' : '💾 Save'}
                            </button>
                            <button
                              onClick={handleEditCancel}
                              className="cancel-button"
                              disabled={saving}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {user?.role === 'admin' && (
                              <>
                                <button
                                  onClick={() => handleEditClick(test)}
                                  className="edit-button"
                                  disabled={
                                    deleting ||
                                    resending === test.id ||
                                    editing !== null ||
                                    (pdfLoading && pdfLoading.id === test.id)
                                  }
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(test.id, test.clientName)}
                                  className="delete-button"
                                  disabled={
                                    deleting ||
                                    resending === test.id ||
                                    editing !== null ||
                                    (pdfLoading && pdfLoading.id === test.id)
                                  }
                                >
                                  🗑️ Delete
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePreviewResultPdf(test)}
                              className="result-pdf-preview-button"
                              disabled={
                                (pdfLoading && pdfLoading.id === test.id) ||
                                deleting ||
                                resending === test.id ||
                                editing !== null ||
                                !test.clientName?.trim()
                              }
                              title={!test.clientName?.trim() ? 'Client name required for PDF' : 'Open PDF preview'}
                            >
                              {pdfLoading?.id === test.id && pdfLoading?.action === 'preview'
                                ? 'Opening...'
                                : 'Preview PDF'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadResultPdf(test)}
                              className="result-pdf-download-button"
                              disabled={
                                (pdfLoading && pdfLoading.id === test.id) ||
                                deleting ||
                                resending === test.id ||
                                editing !== null ||
                                !test.clientName?.trim()
                              }
                              title={!test.clientName?.trim() ? 'Client name required for PDF' : 'Download e-card as PDF'}
                            >
                              {pdfLoading?.id === test.id && pdfLoading?.action === 'download'
                                ? 'Preparing...'
                                : 'Download PDF'}
                            </button>
                            <button
                              onClick={() => handleResend(test)}
                              className="resend-button"
                              disabled={
                                resending === test.id ||
                                deleting ||
                                editing !== null ||
                                !test.recipientEmail ||
                                (pdfLoading && pdfLoading.id === test.id)
                              }
                              title={!test.recipientEmail ? 'No recipient email available' : 'Resend e-card'}
                            >
                              {resending === test.id ? 'Sending...' : '📧 Resend'}
                            </button>
                            {user?.role !== 'admin' && (
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
                                Only admin users can edit or delete test results.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="modal-overlay" onClick={handleDeleteCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Confirm Delete</h3>
              <p>
                Are you sure you want to delete the fit test record for{' '}
                <strong>"{deleteConfirm.clientName}"</strong>?
              </p>
              <p className="modal-warning">This action cannot be undone.</p>
              <div className="modal-buttons">
                <button
                  onClick={handleDeleteCancel}
                  className="modal-button cancel-button"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="modal-button confirm-delete-button"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FitTestResults;

