import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getUserSolutionProfiles,
  saveUserSolutionProfile,
  deleteUserSolutionProfile,
  reorderUserSolutionProfiles,
  setDefaultSolutionProfile,
  getUserSchoolProfiles,
  saveUserSchoolProfile,
  deleteUserSchoolProfile,
  reorderUserSchoolProfiles,
  setDefaultSchoolProfile,
  getPendingUsers,
  updateUserApprovalStatus,
} from '../../services/firebaseDb';
import { useSavedProfiles } from '../../hooks/useSavedProfiles';
import SavedProfilesPanel from './SavedProfilesPanel';
import './EditAccount.css';

const EMPTY_SOLUTION_FORM = {
  solutionType: '',
  solutionOpenDate: '',
  solutionExpirationDate: '',
  setAsDefault: false,
};

const toSolutionPayload = (data) => ({
  solutionType: data.solutionType.trim(),
  solutionOpenDate: data.solutionOpenDate.trim(),
  solutionExpirationDate: data.solutionExpirationDate.trim(),
});

const toSchoolPayload = (data) => ({
  schoolName: data.schoolName.trim(),
});

const EMPTY_SCHOOL_FORM = {
  schoolName: '',
  setAsDefault: false,
};

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
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingUsersLoading, setPendingUsersLoading] = useState(false);
  const [pendingUsersError, setPendingUsersError] = useState('');
  const [pendingUsersSuccess, setPendingUsersSuccess] = useState('');

  const solutionProfiles = useSavedProfiles({
    userId: user?.uid,
    fetchAll: getUserSolutionProfiles,
    save: saveUserSolutionProfile,
    remove: deleteUserSolutionProfile,
    reorder: reorderUserSolutionProfiles,
    setDefault: setDefaultSolutionProfile,
    emptyForm: EMPTY_SOLUTION_FORM,
    toPayload: toSolutionPayload,
    dateFields: ['solutionOpenDate', 'solutionExpirationDate'],
  });

  const schoolProfiles = useSavedProfiles({
    userId: user?.uid,
    fetchAll: getUserSchoolProfiles,
    save: saveUserSchoolProfile,
    remove: deleteUserSchoolProfile,
    reorder: reorderUserSchoolProfiles,
    setDefault: setDefaultSchoolProfile,
    emptyForm: EMPTY_SCHOOL_FORM,
    toPayload: toSchoolPayload,
  });

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

  const loadPendingUsers = async () => {
    if (!user?.uid || user?.role !== 'admin') return;
    setPendingUsersLoading(true);
    setPendingUsersError('');
    try {
      const users = await getPendingUsers(user.uid);
      setPendingUsers(users);
    } catch (err) {
      setPendingUsersError(err.message || 'Failed to load pending users.');
    } finally {
      setPendingUsersLoading(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.role]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setSuccess('');
  };

  const handleApprovalAction = async (targetUserId, nextStatus) => {
    if (!user?.uid || user?.role !== 'admin') return;
    setPendingUsersError('');
    setPendingUsersSuccess('');

    try {
      await updateUserApprovalStatus(user.uid, targetUserId, nextStatus);
      setPendingUsersSuccess(
        nextStatus === 'approved'
          ? 'User approved successfully.'
          : 'User rejected successfully.'
      );
      await loadPendingUsers();
    } catch (err) {
      setPendingUsersError(err.message || 'Failed to update approval status.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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

          <SavedProfilesPanel
            title="Saved Solution Profiles"
            description="Add, reorder, set default, or delete your own saved solution options."
            error={solutionProfiles.error}
            success={solutionProfiles.success}
            fields={[
              { name: 'solutionType', label: 'Solution Type', placeholder: 'Enter solution type', defaultId: 'setAsDefault', defaultLabel: 'Set as new default solution' },
              { name: 'solutionOpenDate', label: 'Open Date', placeholder: 'MM/DD/YYYY', date: true },
              { name: 'solutionExpirationDate', label: 'Expiration Date', placeholder: 'MM/DD/YYYY', date: true },
            ]}
            formData={solutionProfiles.formData}
            onChange={solutionProfiles.handleChange}
            onAdd={(e) => solutionProfiles.handleAdd(e, (data) => {
              if (!data.solutionType.trim()) return 'Please enter solution type.';
              if (!data.solutionOpenDate.trim()) return 'Please enter open date.';
              if (!data.solutionExpirationDate.trim()) return 'Please enter expiration date.';
              return '';
            }, 'Saved solution profile added.')}
            addLabel="+ Add Solution Profile"
            savingLabel="Saving..."
            saving={solutionProfiles.saving}
            disabled={isLoading}
            profiles={solutionProfiles.profiles}
            loading={solutionProfiles.loading}
            loadingLabel="Loading saved solutions..."
            emptyLabel="No saved solution profiles yet."
            renderDetails={(profile) => (
              <>
                <strong>{profile.solutionType}</strong>
                <span>Open: {profile.solutionOpenDate}</span>
                <span>Exp: {profile.solutionExpirationDate}</span>
              </>
            )}
            onMove={(index, direction) =>
              solutionProfiles.handleMove(index, direction, 'Solution profile order updated.')
            }
            onSetDefault={(id) =>
              solutionProfiles.handleSetDefault(id, 'Default solution profile updated.')
            }
            onDelete={(id) =>
              solutionProfiles.handleDelete(id, 'Solution profile deleted.')
            }
          />

          <SavedProfilesPanel
            title="Saved School / Client Profiles"
            description="Add, reorder, set default, or delete schools/clients used on the fit test form."
            error={schoolProfiles.error}
            success={schoolProfiles.success}
            fields={[
              { name: 'schoolName', id: 'schoolName', label: 'School Name', placeholder: 'Enter school name', defaultId: 'schoolSetAsDefault', defaultLabel: 'Set as new default school' },
            ]}
            formData={schoolProfiles.formData}
            onChange={schoolProfiles.handleChange}
            onAdd={(e) => schoolProfiles.handleAdd(e, (data) => (
              data.schoolName.trim() ? '' : 'Please enter school name.'
            ), 'Saved school profile added.')}
            addLabel="+ Add School Profile"
            savingLabel="Saving..."
            saving={schoolProfiles.saving}
            disabled={isLoading}
            profiles={schoolProfiles.profiles}
            loading={schoolProfiles.loading}
            loadingLabel="Loading saved schools..."
            emptyLabel="No saved school profiles yet."
            renderDetails={(profile) => <strong>{profile.schoolName}</strong>}
            onMove={(index, direction) =>
              schoolProfiles.handleMove(index, direction, 'School profile order updated.')
            }
            onSetDefault={(id) =>
              schoolProfiles.handleSetDefault(id, 'Default school profile updated.')
            }
            onDelete={(id) =>
              schoolProfiles.handleDelete(id, 'School profile deleted.')
            }
          />

          {user?.role === 'admin' && (
            <div className="form-section">
              <h3 className="section-title">Pending User Approvals</h3>
              <p className="section-description">
                Approve or reject new user account requests before they can access the app.
              </p>

              {pendingUsersError && <div className="auth-error">{pendingUsersError}</div>}
              {pendingUsersSuccess && <div className="auth-success">{pendingUsersSuccess}</div>}

              <button
                type="button"
                className="solution-add-button"
                onClick={loadPendingUsers}
                disabled={pendingUsersLoading || isLoading}
                style={{ marginBottom: '10px' }}
              >
                {pendingUsersLoading ? 'Refreshing...' : 'Refresh Pending Users'}
              </button>

              <div className="solution-profile-list">
                {pendingUsersLoading ? (
                  <div className="solution-empty">Loading pending approvals...</div>
                ) : pendingUsers.length === 0 ? (
                  <div className="solution-empty">No pending users.</div>
                ) : (
                  pendingUsers.map((pendingUser) => (
                    <div key={pendingUser.id} className="solution-profile-item">
                      <div className="solution-profile-details">
                        <strong>{pendingUser.name || 'No Name'}</strong>
                        <span>{pendingUser.email || 'No Email'}</span>
                        <span>
                          Requested:{' '}
                          {pendingUser.requestedAt
                            ? new Date(pendingUser.requestedAt).toLocaleString()
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="solution-profile-actions">
                        <button
                          type="button"
                          onClick={() => handleApprovalAction(pendingUser.id, 'approved')}
                          disabled={pendingUsersLoading || isLoading}
                          title="Approve user"
                        >
                          ✅
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprovalAction(pendingUser.id, 'rejected')}
                          disabled={pendingUsersLoading || isLoading}
                          title="Reject user"
                        >
                          ❌
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

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
