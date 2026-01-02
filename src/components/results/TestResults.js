import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserFitTests, deleteFitTest, updateFitTest } from '../../services/firebaseDb';
import { sendFitTestCard } from '../../services/emailService';
import { formatDateInput } from '../../utils/dateUtils';
import './TestResults.css';

const TestResults = () => {
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

      await deleteFitTest(deleteConfirm.id);
      
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
      const formData = {
        recipientEmail: test.recipientEmail,
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
      };

      // Step 1: Send email via EmailJS
      await sendFitTestCard(formData);
      
      // Step 2: Update the existing record's timestamp (does NOT create a new record)
      // This ensures the record reflects that it was resent
      try {
        await updateFitTest(test.id, {
          // Only update the timestamp, keep all other data the same
          // This ensures we're updating the existing record, not creating a new one
        });
        
        // Refresh the list to show updated timestamp
        await loadFitTests();
      } catch (updateError) {
        console.error('Error updating record timestamp:', updateError);
        // Email was sent successfully, but timestamp update failed - not critical
      }
      
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

      // Update the record in Firebase
      await updateFitTest(testId, editData);
      
      // Update local state
      setFitTests(prev => prev.map(test => 
        test.id === testId ? { ...test, ...editData } : test
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
                            <select
                              className="edit-select"
                              value={editData.respiratorMfg || '3M'}
                              onChange={(e) => handleEditChange('respiratorMfg', e.target.value)}
                            >
                              <option value="3M">3M</option>
                              <option value="Honeywell">Honeywell</option>
                              <option value="Moldex">Moldex</option>
                              <option value="Kimberly-Clark">Kimberly-Clark</option>
                              <option value="Other">Other</option>
                            </select>
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
                              onChange={(e) => handleEditChange('fitTester', e.target.value)}
                              placeholder="Fit tester name"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="result-card-body">
                          <div className="result-row">
                            <span className="result-label">Issue Date:</span>
                            <span className="result-value">{test.issueDate || 'N/A'}</span>
                          </div>
                          <div className="result-row">
                            <span className="result-label">Fit Test Type:</span>
                            <span className="result-value">{test.fitTestType || 'N/A'}</span>
                          </div>
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
                            <button
                              onClick={() => handleEditClick(test)}
                              className="edit-button"
                              disabled={deleting || resending === test.id || editing !== null}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleResend(test)}
                              className="resend-button"
                              disabled={resending === test.id || deleting || editing !== null || !test.recipientEmail}
                              title={!test.recipientEmail ? 'No recipient email available' : 'Resend e-card'}
                            >
                              {resending === test.id ? 'Sending...' : '📧 Resend'}
                            </button>
                            <button
                              onClick={() => handleDeleteClick(test.id, test.clientName)}
                              className="delete-button"
                              disabled={deleting || resending === test.id || editing !== null}
                            >
                              🗑️ Delete
                            </button>
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

export default TestResults;

