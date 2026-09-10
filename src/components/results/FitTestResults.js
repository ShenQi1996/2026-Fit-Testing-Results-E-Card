import React from 'react';
import { useFitTestResults } from '../../hooks/useFitTestResults';
import { groupTestsByMonth } from './resultsUtils';
import ResultsFilters from './ResultsFilters';
import ResultCard from './ResultCard';
import './FitTestResults.css';

const FitTestResults = () => {
  const {
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
  } = useFitTestResults();

  const groupedTests = groupTestsByMonth(filteredFitTests);

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
          <div className="results-header-main">
            <div className="results-header-copy">
              <h2 className="results-title">Fit Test Results</h2>
              <p className="results-retention-note">
                Records are kept for 3 years from the test date, then removed automatically.
              </p>
            </div>
            <div className="results-header-actions">
              <button
                type="button"
                onClick={handleExportCsv}
                className="export-csv-button"
                disabled={exportingCsv || filteredFitTests.length === 0}
                title={
                  filteredFitTests.length === 0
                    ? 'No filtered results to export'
                    : 'Export currently filtered results as CSV'
                }
              >
                {exportingCsv ? 'Exporting...' : '⬇ Export CSV'}
              </button>
              <button onClick={loadFitTests} className="refresh-button">
                🔄 Refresh
              </button>
            </div>
          </div>

          <ResultsFilters
            monthFilter={monthFilter}
            setMonthFilter={setMonthFilter}
            monthOptions={monthOptions}
            schoolFilter={schoolFilter}
            setSchoolFilter={setSchoolFilter}
            schoolOptions={schoolOptions}
            locationFilter={locationFilter}
            setLocationFilter={setLocationFilter}
            locationOptions={locationOptions}
            filteredCount={filteredFitTests.length}
            totalCount={fitTests.length}
          />
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
        ) : filteredFitTests.length === 0 ? (
          <div className="empty-state">
            <p>No results match your filters.</p>
            <p>Try a different month, school, or location.</p>
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
                    <ResultCard
                      key={test.id}
                      test={test}
                      user={user}
                      editing={editing}
                      editData={editData}
                      saving={saving}
                      deleting={deleting}
                      resending={resending}
                      pdfLoading={pdfLoading}
                      isCustomEditLocation={isCustomEditLocation}
                      expanded={isCardExpanded(test.id)}
                      onToggleExpand={toggleCardExpansion}
                      onEditChange={handleEditChange}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                      onEditClick={handleEditClick}
                      onDeleteClick={handleDeleteClick}
                      onPreviewPdf={handlePreviewResultPdf}
                      onDownloadPdf={handleDownloadResultPdf}
                      onResend={handleResend}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

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
