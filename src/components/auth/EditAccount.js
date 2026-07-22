import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getUserSolutionProfiles,
  saveUserSolutionProfile,
  deleteUserSolutionProfile,
  reorderUserSolutionProfiles,
  setDefaultSolutionProfile,
} from '../../services/firebaseDb';
import { formatDateInput } from '../../utils/dateUtils';
import './EditAccount.css';

const EditAccount = ({ onBack }) => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [solutionProfiles, setSolutionProfiles] = useState([]);
  const [solutionProfileData, setSolutionProfileData] = useState({
    solutionType: '',
    solutionOpenDate: '',
    solutionExpirationDate: '',
    setAsDefault: false,
  });
  const [solutionProfilesLoading, setSolutionProfilesLoading] = useState(false);
  const [solutionProfileSaving, setSolutionProfileSaving] = useState(false);
  const [solutionProfilesError, setSolutionProfilesError] = useState('');
  const [solutionProfilesSuccess, setSolutionProfilesSuccess] = useState('');

  const loadSolutionProfiles = async () => {
    if (!user?.uid) return;

    setSolutionProfilesLoading(true);
    setSolutionProfilesError('');
    try {
      const profiles = await getUserSolutionProfiles(user.uid);
      setSolutionProfiles(profiles);
    } catch (err) {
      setSolutionProfilesError(err.message || 'Failed to load saved solution profiles.');
    } finally {
      setSolutionProfilesLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [user]);

  useEffect(() => {
    loadSolutionProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setSuccess('');
  };

  const handleSolutionProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    const isDateField = name === 'solutionOpenDate' || name === 'solutionExpirationDate';
    const nextValue = isDateField ? formatDateInput(value) : value;
    setSolutionProfileData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : nextValue,
    }));
    setSolutionProfilesError('');
    setSolutionProfilesSuccess('');
  };

  const handleAddSolutionProfile = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;

    setSolutionProfilesError('');
    setSolutionProfilesSuccess('');

    if (!solutionProfileData.solutionType.trim()) {
      setSolutionProfilesError('Please enter solution type.');
      return;
    }
    if (!solutionProfileData.solutionOpenDate.trim()) {
      setSolutionProfilesError('Please enter open date.');
      return;
    }
    if (!solutionProfileData.solutionExpirationDate.trim()) {
      setSolutionProfilesError('Please enter expiration date.');
      return;
    }

    setSolutionProfileSaving(true);
    try {
      await saveUserSolutionProfile(
        user.uid,
        {
          solutionType: solutionProfileData.solutionType.trim(),
          solutionOpenDate: solutionProfileData.solutionOpenDate.trim(),
          solutionExpirationDate: solutionProfileData.solutionExpirationDate.trim(),
        },
        solutionProfileData.setAsDefault
      );

      setSolutionProfileData({
        solutionType: '',
        solutionOpenDate: '',
        solutionExpirationDate: '',
        setAsDefault: false,
      });
      setSolutionProfilesSuccess('Saved solution profile added.');
      await loadSolutionProfiles();
    } catch (err) {
      setSolutionProfilesError(err.message || 'Failed to add solution profile.');
    } finally {
      setSolutionProfileSaving(false);
    }
  };

  const handleDeleteSolutionProfile = async (profileId) => {
    if (!user?.uid) return;
    setSolutionProfilesError('');
    setSolutionProfilesSuccess('');

    try {
      await deleteUserSolutionProfile(user.uid, profileId);
      setSolutionProfilesSuccess('Solution profile deleted.');
      await loadSolutionProfiles();
    } catch (err) {
      setSolutionProfilesError(err.message || 'Failed to delete solution profile.');
    }
  };

  const handleMoveSolutionProfile = async (currentIndex, direction) => {
    if (!user?.uid) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= solutionProfiles.length) return;

    const reordered = [...solutionProfiles];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[nextIndex];
    reordered[nextIndex] = temp;

    setSolutionProfiles(reordered);
    setSolutionProfilesError('');
    setSolutionProfilesSuccess('');

    try {
      await reorderUserSolutionProfiles(
        user.uid,
        reordered.map((profile) => profile.id)
      );
      setSolutionProfilesSuccess('Solution profile order updated.');
    } catch (err) {
      setSolutionProfilesError(err.message || 'Failed to reorder solution profiles.');
      await loadSolutionProfiles();
    }
  };

  const handleSetDefaultSolutionProfile = async (profileId) => {
    if (!user?.uid) return;

    setSolutionProfilesError('');
    setSolutionProfilesSuccess('');
    try {
      await setDefaultSolutionProfile(user.uid, profileId);
      setSolutionProfilesSuccess('Default solution profile updated.');
      await loadSolutionProfiles();
    } catch (err) {
      setSolutionProfilesError(err.message || 'Failed to set default solution profile.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate password change if new password is provided
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setError('Please enter your current password to change it');
        return;
      }

      if (formData.newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match');
        return;
      }
    }

    setIsLoading(true);

    try {
      await updateUser({
        name: formData.name,
        email: formData.email,
        currentPassword: formData.currentPassword || undefined,
        newPassword: formData.newPassword || undefined,
      });
      setSuccess('Account updated successfully!');
      
      // Clear password fields after successful update
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(err.message || 'Failed to update account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="edit-account-container">
      <div className="edit-account-card">
        <div className="edit-account-header">
          <h2 className="edit-account-title">Edit Account</h2>
          <button onClick={onBack} className="back-button">
            ← Back to Form
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit} className="edit-account-form">
          <div className="form-section">
            <h3 className="section-title">Personal Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-input"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Account Role</label>
              <div style={{ 
                padding: '10px 12px', 
                backgroundColor: 'var(--bg-secondary, #f5f5f5)', 
                border: '1px solid var(--border-color, #ddd)',
                borderRadius: '4px',
                cursor: 'not-allowed',
                fontWeight: 500,
                color: user?.role === 'admin' ? 'var(--accent-blue, #2563eb)' : 'var(--text-secondary, #666)',
                fontSize: '14px'
              }}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Tester'}
              </div>
              <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary, #666)', fontSize: '12px' }}>
                {user?.role === 'admin' 
                  ? 'You have admin privileges and can edit/delete test results.' 
                  : 'You have tester privileges. Contact an admin to change your role.'}
              </small>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Change Password (Optional)</h3>
            <p className="section-description">Leave blank if you don't want to change your password</p>
            
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                className="form-input"
                placeholder="Enter current password"
                value={formData.currentPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                className="form-input"
                placeholder="Enter new password (min. 6 characters)"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="form-input"
                placeholder="Confirm new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Saved Solution Profiles</h3>
            <p className="section-description">
              Add, reorder, set default, or delete your own saved solution options.
            </p>

            {solutionProfilesError && <div className="auth-error">{solutionProfilesError}</div>}
            {solutionProfilesSuccess && <div className="auth-success">{solutionProfilesSuccess}</div>}

            <div className="solution-profile-add-grid">
              <div className="form-group">
                <label htmlFor="solutionType">Solution Type</label>
                <input
                  type="text"
                  id="solutionType"
                  name="solutionType"
                  className="form-input"
                  placeholder="Enter solution type"
                  value={solutionProfileData.solutionType}
                  onChange={handleSolutionProfileChange}
                  disabled={solutionProfileSaving || isLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="solutionOpenDate">Open Date</label>
                <input
                  type="text"
                  id="solutionOpenDate"
                  name="solutionOpenDate"
                  className="form-input"
                  placeholder="MM/DD/YYYY"
                  value={solutionProfileData.solutionOpenDate}
                  onChange={handleSolutionProfileChange}
                  inputMode="numeric"
                  maxLength={10}
                  disabled={solutionProfileSaving || isLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="solutionExpirationDate">Expiration Date</label>
                <input
                  type="text"
                  id="solutionExpirationDate"
                  name="solutionExpirationDate"
                  className="form-input"
                  placeholder="MM/DD/YYYY"
                  value={solutionProfileData.solutionExpirationDate}
                  onChange={handleSolutionProfileChange}
                  inputMode="numeric"
                  maxLength={10}
                  disabled={solutionProfileSaving || isLoading}
                />
              </div>
            </div>

            <div className="form-group solution-default-toggle">
              <label htmlFor="setAsDefault">
                <input
                  type="checkbox"
                  id="setAsDefault"
                  name="setAsDefault"
                  checked={solutionProfileData.setAsDefault}
                  onChange={handleSolutionProfileChange}
                  disabled={solutionProfileSaving || isLoading}
                />
                Set as new default solution
              </label>
            </div>

            <button
              type="button"
              className="solution-add-button"
              onClick={handleAddSolutionProfile}
              disabled={solutionProfileSaving || isLoading}
            >
              {solutionProfileSaving ? 'Saving...' : '+ Add Solution Profile'}
            </button>

            <div className="solution-profile-list">
              {solutionProfilesLoading ? (
                <div className="solution-empty">Loading saved solutions...</div>
              ) : solutionProfiles.length === 0 ? (
                <div className="solution-empty">No saved solution profiles yet.</div>
              ) : (
                solutionProfiles.map((profile, index) => (
                  <div key={profile.id} className="solution-profile-item">
                    <div className="solution-profile-details">
                      <strong>{profile.solutionType}</strong>
                      <span>Open: {profile.solutionOpenDate}</span>
                      <span>Exp: {profile.solutionExpirationDate}</span>
                      {profile.isDefault && <span className="solution-default-badge">Default</span>}
                    </div>
                    <div className="solution-profile-actions">
                      <button
                        type="button"
                        onClick={() => handleMoveSolutionProfile(index, -1)}
                        disabled={index === 0 || isLoading}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSolutionProfile(index, 1)}
                        disabled={index === solutionProfiles.length - 1 || isLoading}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetDefaultSolutionProfile(profile.id)}
                        disabled={profile.isDefault || isLoading}
                        title="Set as default"
                      >
                        ⭐
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSolutionProfile(profile.id)}
                        disabled={isLoading}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Update Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditAccount;

