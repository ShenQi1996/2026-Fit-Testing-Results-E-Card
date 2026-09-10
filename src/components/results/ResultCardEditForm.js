import React from 'react';
import { formatDateInput } from '../../utils/dateUtils';
import {
  TEST_LOCATION_OPTIONS,
  FIT_TEST_TYPE_OPTIONS,
  RESPIRATOR_MFG_OPTIONS,
  TESTING_AGENT_OPTIONS,
  MASK_SIZE_OPTIONS,
  isCustomOptionValue,
} from '../../constants/fitTestOptions';

const ResultCardEditForm = ({ editData, onChange, isCustomEditLocation }) => {
  const isCustomMfg = isCustomOptionValue(editData.respiratorMfg, RESPIRATOR_MFG_OPTIONS);

  return (
    <div className="result-card-body edit-mode">
      <div className="edit-form-row">
        <label>Recipient Email:</label>
        <input
          type="email"
          className="edit-input"
          value={editData.recipientEmail || ''}
          onChange={(e) => onChange('recipientEmail', e.target.value)}
          placeholder="Recipient email"
        />
      </div>
      <div className="edit-form-row">
        <label>Test Location:</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select
            className="edit-select"
            value={isCustomEditLocation ? 'Other' : (editData.testLocation || '')}
            onChange={(e) => onChange('testLocation', e.target.value)}
          >
            <option value="">Select location</option>
            {TEST_LOCATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {(isCustomEditLocation || editData.testLocation === 'Other') && (
            <input
              type="text"
              className="edit-input"
              placeholder="Enter location"
              value={isCustomEditLocation ? editData.testLocation : ''}
              onChange={(e) => onChange('testLocation', e.target.value)}
            />
          )}
        </div>
      </div>
      <div className="edit-form-row">
        <label>Issue Date:</label>
        <input
          type="text"
          className="edit-input"
          value={editData.issueDate || ''}
          onChange={(e) => onChange('issueDate', e.target.value)}
          placeholder="MM/DD/YYYY"
        />
      </div>
      <div className="edit-form-row">
        <label>Date of Birth:</label>
        <input
          type="text"
          className="edit-input"
          value={editData.dob || ''}
          onChange={(e) => onChange('dob', formatDateInput(e.target.value))}
          placeholder="MM/DD/YYYY"
          maxLength={10}
        />
      </div>
      <div className="edit-form-row">
        <label>Fit Test Type:</label>
        <select
          className="edit-select"
          value={editData.fitTestType || 'N95'}
          onChange={(e) => onChange('fitTestType', e.target.value)}
        >
          {FIT_TEST_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="edit-form-row">
        <label>Respirator MFG:</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select
            className="edit-select"
            value={isCustomMfg ? 'Other' : (editData.respiratorMfg || '3M')}
            onChange={(e) => {
              const selectedValue = e.target.value;
              if (selectedValue === 'Other') {
                onChange('respiratorMfg', 'Other');
              } else {
                onChange('respiratorMfg', selectedValue);
              }
            }}
          >
            {RESPIRATOR_MFG_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {(editData.respiratorMfg === 'Other' || isCustomMfg) && (
            <input
              type="text"
              className="edit-input"
              placeholder="Enter manufacturer name"
              value={isCustomMfg ? editData.respiratorMfg : ''}
              onChange={(e) => onChange('respiratorMfg', e.target.value)}
            />
          )}
        </div>
      </div>
      <div className="edit-form-row">
        <label>Testing Agent:</label>
        <select
          className="edit-select"
          value={editData.testingAgent || 'Bitrex'}
          onChange={(e) => onChange('testingAgent', e.target.value)}
        >
          {TESTING_AGENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="edit-form-row">
        <label>Mask Size:</label>
        <select
          className="edit-select"
          value={editData.maskSize || 'Regular'}
          onChange={(e) => onChange('maskSize', e.target.value)}
        >
          {MASK_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="edit-form-row">
        <label>Model:</label>
        <input
          type="text"
          className="edit-input"
          value={editData.model || ''}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder="e.g., 1870+"
        />
      </div>
      <div className="edit-form-row">
        <label>Fit Tester:</label>
        <input
          type="text"
          className="edit-input"
          value={editData.fitTester || ''}
          onChange={() => {}}
          placeholder="Fit tester name"
          disabled
          style={{ opacity: 0.7, cursor: 'not-allowed' }}
        />
      </div>
    </div>
  );
};

export default ResultCardEditForm;
