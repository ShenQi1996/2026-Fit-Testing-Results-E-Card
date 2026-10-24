import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getUserSolutionProfiles,
  saveUserSolutionProfile,
  deleteUserSolutionProfile,
  reorderUserSolutionProfiles,
  setDefaultSolutionProfile,
} from '../../services/firebaseDb';
import { listMasterSchools } from '../../services/masterSchools';
import { useSavedProfiles } from '../../hooks/useSavedProfiles';
import { isAdminOrAbove, isSuperAdmin, USER_ROLE_ADMIN } from '../../utils/roles';
import { normalizeSchoolList } from '../../utils/schoolScope';
import { accountSchoolLabel } from '../../utils/ecardSchools';
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

const EditAccount = ({ onBack, onManageSchools }) => {
  const { user, updateUser } = useAuth();
  const staffAdmin = isAdminOrAbove(user);
  const superAdmin = isSuperAdmin(user?.role);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    programAdministratorName: '',
    programAdministratorContact: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [masterSchools, setMasterSchools] = useState([]);

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

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        programAdministratorName: user.programAdministratorName || '',
        programAdministratorContact: user.programAdministratorContact || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!superAdmin) {
      setMasterSchools([]);
      return undefined;
    }
    let cancelled = false;
    listMasterSchools()
      .then((names) => {
        if (!cancelled) setMasterSchools(names);
      })
      .catch(() => {
        if (!cancelled) setMasterSchools([]);
      });
    return () => {
      cancelled = true;
    };
  }, [superAdmin, user?.uid]);

  const assignedSchools = user?.role === USER_ROLE_ADMIN
    ? normalizeSchoolList(user?.schools)
    : [];
  const testerSchool = typeof user?.school === 'string' ? user.school.trim() : '';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setSuccess('');
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
        programAdministratorName: formData.programAdministratorName,
        programAdministratorContact: formData.programAdministratorContact,
      });
      setSuccess('Account updated successfully!');

      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
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
              <label htmlFor="programAdministratorName">Program administrator name</label>
              <input
                type="text"
                id="programAdministratorName"
                name="programAdministratorName"
                className="form-input"
                placeholder="Optional"
                value={formData.programAdministratorName}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="programAdministratorContact">Program administrator contact</label>
              <input
                type="text"
                id="programAdministratorContact"
                name="programAdministratorContact"
                className="form-input"
                placeholder="Optional email or phone"
                value={formData.programAdministratorContact}
                onChange={handleChange}
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
                color: staffAdmin ? 'var(--accent-blue, #2563eb)' : 'var(--text-secondary, #666)',
                fontSize: '14px'
              }}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Tester'}
              </div>
              <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary, #666)', fontSize: '12px' }}>
                {superAdmin
                  ? 'You are a super admin. You can grant admin access and edit or delete test results.'
                  : staffAdmin
                    ? 'You have admin privileges. You can approve testers and edit or delete test results.'
                    : 'You have tester privileges. Contact an admin to change your role.'}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="account-school">School</label>
              <div
                id="account-school"
                aria-label="Account school"
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                  border: '1px solid var(--border-color, #ddd)',
                  borderRadius: '4px',
                  cursor: 'not-allowed',
                  fontWeight: 500,
                  color: 'var(--text-secondary, #666)',
                  fontSize: '14px'
                }}
              >
                {accountSchoolLabel(user)}
              </div>
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

          <section className="account-schools" aria-label="Account schools">
            <h3 className="section-title">Schools</h3>
            {superAdmin ? (
              <>
                <p className="section-description">
                  Master school list. The fit test form offers these names to super admins.
                  Add, edit, or remove them in Users Management.
                </p>
                {masterSchools.length === 0 ? (
                  <div className="account-school-readonly" aria-label="Master schools">—</div>
                ) : (
                  <ul aria-label="Master schools">
                    {masterSchools.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="auth-button secondary"
                  onClick={onManageSchools}
                >
                  Manage schools
                </button>
              </>
            ) : user?.role === USER_ROLE_ADMIN ? (
              <>
                <p className="section-description">Schools assigned to this admin account.</p>
                {assignedSchools.length === 0 ? (
                  <div className="account-school-readonly" aria-label="Schools">—</div>
                ) : (
                  <ul aria-label="Schools">
                    {assignedSchools.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p className="section-description">
                  Your school is pre-selected on the fit test form.
                </p>
                <div className="account-school-readonly" aria-label="School" aria-readonly="true">
                  {testerSchool || '—'}
                </div>
              </>
            )}
          </section>

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
