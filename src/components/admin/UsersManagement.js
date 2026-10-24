import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  USER_ROLES,
  USER_STATUSES,
  getAllUsers,
  getFitTestCountsByUser,
  getPendingUsers,
  updateManagedUser,
  deleteManagedUser,
  updateUserApprovalStatus,
} from '../../services/firebaseDb';
import { createManagedAuthUser } from '../../services/firebaseAuth';
import {
  addMasterSchool,
  listMasterSchoolRecords,
  removeMasterSchool,
  renameMasterSchool,
  updateMasterSchoolProgram,
} from '../../services/masterSchools';
import {
  USER_ROLE_ADMIN,
  USER_ROLE_SUPERADMIN,
  USER_ROLE_TESTER,
  accessDateInputValue,
  accessWindowOrderError,
  accountStatusLabel,
  canModifyManagedUser,
  isAdminOrAbove,
  isSuperAdmin,
  rolesAssignableBy,
  rolesCreatableBy,
} from '../../utils/roles';
import { filterUsersForActor, normalizeSchoolList } from '../../utils/schoolScope';
import { readProgramAdmin } from '../../utils/programAdmin';
import './UsersManagement.css';

const EMPTY_CREATE_FORM = {
  email: '',
  password: '',
  name: '',
  role: 'tester',
  status: 'pending',
  school: '',
  schools: [],
  programAdministratorName: '',
  programAdministratorContact: '',
};

const toggleSchoolName = (selected, school, checked) => {
  const current = normalizeSchoolList(selected);
  if (checked) return normalizeSchoolList([...current, school]);
  return current.filter((name) => name !== school);
};

const SchoolCheckboxGroup = ({
  schools,
  selected,
  onChange,
  disabled,
  error,
}) => (
  <fieldset
    className={`school-checkboxes${error ? ' field-invalid' : ''}`}
    aria-label="Schools"
    aria-invalid={error ? true : undefined}
    disabled={disabled}
  >
    <legend>Schools</legend>
    <div className="school-checkbox-list">
      {schools.map((school) => {
        const checked = selected.includes(school);
        return (
          <label key={school} className={`school-checkbox${checked ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onChange(toggleSchoolName(selected, school, event.target.checked))}
            />
            <span>{school}</span>
          </label>
        );
      })}
    </div>
    <FieldMessage message={error} />
  </fieldset>
);

const withAssignedNames = (masterNames, assignedNames) => {
  const extras = normalizeSchoolList(assignedNames).filter((name) => !masterNames.includes(name));
  return [...masterNames, ...extras];
};

const NO_SCHOOLS_CREATE_MESSAGE = 'You have no schools assigned, so you cannot add a tester. Ask a super admin to assign a school.';
const SCHOOL_REQUIRED_MESSAGE = 'At least one school is required.';
const FIELD_REQUIRED_MESSAGES = {
  name: 'Name is required.',
  email: 'Email is required.',
  role: 'Role is required.',
  password: 'Password is required.',
  schools: SCHOOL_REQUIRED_MESSAGE,
};

const isBlank = (value) => !String(value ?? '').trim();

const dropFieldError = (errors, field, fixed) => {
  if (!errors?.[field] || !fixed) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
};

const FieldMessage = ({ message }) => (
  message ? <span className="field-error" role="alert">{message}</span> : null
);

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch (error) {
    return iso;
  }
};

const PendingApprovals = ({
  users,
  loading,
  error,
  success,
  approvingId,
  onApprove,
  onReject,
}) => (
  <div className="pending-approvals">
    <p className="users-hint">
      Approve or reject new user account requests before they can access the app.
    </p>
    {error && <div className="users-error">{error}</div>}
    {success && <div className="users-success">{success}</div>}
    {loading ? (
      <div className="users-empty">Loading pending approvals...</div>
    ) : users.length === 0 ? (
      <div className="users-empty">No pending users.</div>
    ) : (
      <div className="users-list">
        {users.map((pendingUser) => (
          <article key={pendingUser.id} className="user-card pending-approval-card">
            <div className="user-card-top">
              <div>
                <h3>{pendingUser.name || 'No Name'}</h3>
                <p className="pending-approval-email">{pendingUser.email || 'No Email'}</p>
                <p className="pending-approval-role">Role: {pendingUser.role || 'tester'}</p>
                <p className="pending-approval-requested">
                  Requested: {pendingUser.requestedAt ? formatDate(pendingUser.requestedAt) : 'N/A'}
                </p>
              </div>
              <div className="user-badges">
                <span className={`user-badge role-${pendingUser.role || 'tester'}`}>
                  {pendingUser.role || 'tester'}
                </span>
                <span className="user-badge status-pending">pending</span>
              </div>
            </div>
            <div className="user-card-actions">
              <button
                type="button"
                className="users-primary-button"
                onClick={() => onApprove(pendingUser.id)}
                disabled={approvingId !== null}
                title="Approve user"
              >
                {approvingId === pendingUser.id ? 'Approving...' : 'Approve'}
              </button>
              <button
                type="button"
                className="users-danger-button"
                onClick={() => onReject(pendingUser.id)}
                disabled={approvingId !== null}
                title="Reject user"
              >
                {approvingId === pendingUser.id ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </article>
        ))}
      </div>
    )}
  </div>
);

const UsersManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [testCounts, setTestCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editDrafts, setEditDrafts] = useState({});
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [rosterView, setRosterView] = useState('all');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [pendingSuccess, setPendingSuccess] = useState('');
  const [approvingId, setApprovingId] = useState(null);
  const [masterSchools, setMasterSchools] = useState([]);
  const [masterSchoolRecords, setMasterSchoolRecords] = useState([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramContact, setNewProgramContact] = useState('');
  const [editingSchool, setEditingSchool] = useState(null);
  const [schoolListError, setSchoolListError] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [createFieldErrors, setCreateFieldErrors] = useState({});

  const isAdmin = isAdminOrAbove(user);
  const superAdmin = isSuperAdmin(user?.role);
  const assignableRoles = rolesAssignableBy(user?.role);
  const creatableRoles = rolesCreatableBy(user?.role);

  const loadUsers = useCallback(async () => {
    if (!user?.uid || !isAdmin) return;

    setLoading(true);
    setError('');
    try {
      const [allUsers, counts] = await Promise.all([
        getAllUsers(user.uid),
        getFitTestCountsByUser(user.uid),
      ]);
      setUsers(allUsers);
      setTestCounts(counts || {});

      const drafts = {};
      allUsers.forEach((item) => {
        drafts[item.id] = {
          name: item.name || '',
          email: item.email || '',
          role: item.role || 'tester',
          status: item.status || 'pending',
          school: item.school || '',
          schools: Array.isArray(item.schools) ? [...item.schools] : [],
          startDate: accessDateInputValue(item.startDate),
          endDate: accessDateInputValue(item.endDate),
          ...readProgramAdmin(item),
        };
      });
      setEditDrafts(drafts);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isAdmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const refreshMasterSchools = useCallback(async () => {
    if (!user?.uid || !superAdmin) {
      setMasterSchools([]);
      return;
    }
    try {
      const records = await listMasterSchoolRecords();
      setMasterSchoolRecords(records);
      setMasterSchools(records.map((record) => record.name));
      setSchoolListError('');
    } catch (err) {
      setSchoolListError(err.message || 'Failed to load schools.');
    }
  }, [user?.uid, superAdmin]);

  useEffect(() => {
    refreshMasterSchools();
  }, [refreshMasterSchools]);

  const visibleUsers = useMemo(
    () => filterUsersForActor(user, users),
    [user, users],
  );

  const loadPendingUsers = useCallback(async ({ quiet = false } = {}) => {
    if (!user?.uid || !isAdmin) return;

    if (!quiet) setPendingLoading(true);
    setPendingError('');
    try {
      const nextUsers = await getPendingUsers(user.uid);
      setPendingUsers(nextUsers);
    } catch (err) {
      console.error(err);
      setPendingError(err.message || 'Failed to load pending users.');
    } finally {
      if (!quiet) setPendingLoading(false);
    }
  }, [user?.uid, isAdmin]);

  useEffect(() => {
    loadPendingUsers();
  }, [loadPendingUsers]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visibleUsers.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (roleFilter !== 'all' && item.role !== roleFilter) return false;
      if (!term) return true;
      return (
        item.name?.toLowerCase().includes(term) ||
        item.email?.toLowerCase().includes(term) ||
        item.id?.toLowerCase().includes(term)
      );
    });
  }, [visibleUsers, search, statusFilter, roleFilter]);

  const visiblePendingUsers = useMemo(() => (
    filterUsersForActor(user, pendingUsers).filter((pendingUser) => (
      canModifyManagedUser(user?.role, pendingUser.role || 'tester')
    ))
  ), [pendingUsers, user]);

  const handleDraftChange = (userId, field, value) => {
    const fixed = field === 'schools'
      ? normalizeSchoolList(value).length > 0
      : !isBlank(value);
    setEditFieldErrors((prev) => {
      const nextFields = dropFieldError(prev[userId], field, fixed);
      if (nextFields === prev[userId]) return prev;
      const next = { ...prev };
      if (!nextFields || Object.keys(nextFields).length === 0) delete next[userId];
      else next[userId] = nextFields;
      return next;
    });
    setEditDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const handleSave = async (targetUserId) => {
    if (!user?.uid) return;
    const draft = editDrafts[targetUserId] || {};
    const target = users.find((item) => item.id === targetUserId);
    const tagRole = draft.role || target?.role || 'tester';
    const selectedSchools = normalizeSchoolList(draft.schools);
    const fieldErrors = {};
    if (superAdmin) {
      if (isBlank(draft.name)) fieldErrors.name = FIELD_REQUIRED_MESSAGES.name;
      if (isBlank(draft.email)) fieldErrors.email = FIELD_REQUIRED_MESSAGES.email;
    }
    if (isBlank(tagRole)) fieldErrors.role = FIELD_REQUIRED_MESSAGES.role;
    if (
      superAdmin
      && targetUserId !== user.uid
      && tagRole === USER_ROLE_ADMIN
      && selectedSchools.length === 0
    ) {
      fieldErrors.schools = FIELD_REQUIRED_MESSAGES.schools;
    }
    if (Object.keys(fieldErrors).length > 0) {
      setEditFieldErrors((prev) => ({ ...prev, [targetUserId]: fieldErrors }));
      setSuccess('');
      return;
    }
    setEditFieldErrors((prev) => {
      if (!prev[targetUserId]) return prev;
      const next = { ...prev };
      delete next[targetUserId];
      return next;
    });
    setSavingId(targetUserId);
    setError('');
    setSuccess('');
    try {
      const updates = {
        name: draft.name,
        email: draft.email,
        role: draft.role,
        status: draft.status,
      };
      if (superAdmin && targetUserId !== user.uid) {
        if (tagRole === USER_ROLE_ADMIN) {
          updates.schools = selectedSchools;
        } else if (tagRole === USER_ROLE_SUPERADMIN) {
          if (selectedSchools.length > 0) updates.schools = selectedSchools;
        } else {
          updates.school = draft.school || '';
        }
        if (tagRole === USER_ROLE_ADMIN) {
          const orderError = accessWindowOrderError(draft.startDate, draft.endDate);
          if (orderError) {
            setError(orderError);
            return;
          }
          updates.startDate = draft.startDate || '';
          updates.endDate = draft.endDate || '';
        }
      }
      updates.programAdministratorName = draft.programAdministratorName || '';
      updates.programAdministratorContact = draft.programAdministratorContact || '';
      const updated = await updateManagedUser(user.uid, targetUserId, updates);
      setUsers((prev) => prev.map((item) => (item.id === targetUserId ? updated : item)));
      setEditDrafts((prev) => ({
        ...prev,
        [targetUserId]: {
          name: updated.name || '',
          email: updated.email || '',
          role: updated.role || 'tester',
          status: updated.status || 'pending',
          school: updated.school || '',
          schools: Array.isArray(updated.schools) ? [...updated.schools] : [],
          startDate: accessDateInputValue(updated.startDate),
          endDate: accessDateInputValue(updated.endDate),
          ...readProgramAdmin(updated),
        },
      }));
      setSuccess(`Saved updates for ${updated.email || updated.name || 'user'}.`);
    } catch (err) {
      setError(err.message || 'Failed to save user.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (targetUser) => {
    if (!user?.uid) return;
    const label = targetUser.email || targetUser.name || targetUser.id;
    const confirmed = window.confirm(
      `Delete the Firestore profile for ${label}?\n\nTheir Firebase Auth login is not deleted. Signing in again creates a new pending profile.`
    );
    if (!confirmed) return;

    setDeletingId(targetUser.id);
    setError('');
    setSuccess('');
    try {
      await deleteManagedUser(user.uid, targetUser.id);
      setUsers((prev) => prev.filter((item) => item.id !== targetUser.id));
      setEditDrafts((prev) => {
        const next = { ...prev };
        delete next[targetUser.id];
        return next;
      });
      setSuccess(`Deleted profile for ${label}.`);
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleApprovalAction = async (targetUserId, nextStatus) => {
    if (!user?.uid || !isAdmin) return;

    setApprovingId(targetUserId);
    setPendingError('');
    setPendingSuccess('');
    try {
      await updateUserApprovalStatus(user.uid, targetUserId, nextStatus);
      setUsers((prev) => prev.map((item) => (
        item.id === targetUserId ? { ...item, status: nextStatus } : item
      )));
      setEditDrafts((prev) => {
        if (!prev[targetUserId]) return prev;
        return {
          ...prev,
          [targetUserId]: {
            ...prev[targetUserId],
            status: nextStatus,
          },
        };
      });
      setPendingSuccess(
        nextStatus === 'approved'
          ? 'User approved successfully.'
          : 'User rejected successfully.'
      );
      await loadPendingUsers({ quiet: true });
    } catch (err) {
      setPendingError(err.message || 'Failed to update approval status.');
    } finally {
      setApprovingId(null);
    }
  };

  const actorSchools = normalizeSchoolList(user?.schools);
  const createRole = creatableRoles.includes(createForm.role) ? createForm.role : 'tester';
  const creatingTester = createRole === USER_ROLE_TESTER;
  const createSchoolMissing = !superAdmin
    && creatingTester
    && actorSchools.length > 1
    && !actorSchools.includes(createForm.school);
  const creatingAdmin = superAdmin && createRole === USER_ROLE_ADMIN;
  const createBlocked = !superAdmin && creatingTester && actorSchools.length === 0;

  const setCreateValue = (field, value) => {
    const fixed = field === 'schools'
      ? normalizeSchoolList(value).length > 0
      : !isBlank(value);
    setCreateFieldErrors((prev) => dropFieldError(prev, field, fixed));
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;
    const role = assignableRoles.includes(createForm.role) ? createForm.role : 'tester';
    const fieldErrors = {};
    if (isBlank(createForm.name)) fieldErrors.name = FIELD_REQUIRED_MESSAGES.name;
    if (isBlank(createForm.email)) fieldErrors.email = FIELD_REQUIRED_MESSAGES.email;
    if (isBlank(createForm.password)) fieldErrors.password = FIELD_REQUIRED_MESSAGES.password;
    if (isBlank(role)) fieldErrors.role = FIELD_REQUIRED_MESSAGES.role;
    if (role === USER_ROLE_ADMIN && normalizeSchoolList(createForm.schools).length === 0) {
      fieldErrors.schools = FIELD_REQUIRED_MESSAGES.schools;
    }
    if (Object.keys(fieldErrors).length > 0) {
      setCreateFieldErrors(fieldErrors);
      setSuccess('');
      return;
    }
    setCreateFieldErrors({});

    setCreating(true);
    setError('');
    setSuccess('');
    try {
      if (!superAdmin && role === USER_ROLE_TESTER && actorSchools.length === 0) {
        throw new Error(NO_SCHOOLS_CREATE_MESSAGE);
      }
      if (!superAdmin && role === USER_ROLE_TESTER && actorSchools.length > 1
        && !actorSchools.includes(createForm.school)) {
        throw new Error('Choose one of your schools before adding a tester.');
      }
      const school = superAdmin
        ? (createForm.school || '').trim()
        : (actorSchools.length === 1 ? actorSchools[0] : (createForm.school || '').trim());
      const payload = {
        email: createForm.email,
        password: createForm.password,
        name: createForm.name,
        role,
        status: createForm.status,
      };
      if (role === USER_ROLE_TESTER && school) payload.school = school;
      if (role === USER_ROLE_ADMIN) {
        payload.schools = normalizeSchoolList(createForm.schools);
      }
      payload.programAdministratorName = createForm.programAdministratorName || '';
      payload.programAdministratorContact = createForm.programAdministratorContact || '';
      const created = await createManagedAuthUser(user.uid, payload);
      setUsers((prev) => [created, ...prev]);
      setEditDrafts((prev) => ({
        ...prev,
        [created.id]: {
          name: created.name || '',
          email: created.email || '',
          role: created.role || 'tester',
          status: created.status || 'pending',
          school: created.school || '',
          schools: Array.isArray(created.schools) ? [...created.schools] : [],
          startDate: accessDateInputValue(created.startDate),
          endDate: accessDateInputValue(created.endDate),
          ...readProgramAdmin(created),
        },
      }));
      setCreateForm(EMPTY_CREATE_FORM);
      setShowCreateForm(false);
      setSuccess(`Created user ${created.email}.`);
    } catch (err) {
      setError(err.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleAddSchool = async () => {
    if (!user?.uid) return;
    setSchoolListError('');
    const added = newSchoolName.trim();
    try {
      await addMasterSchool(user.uid, added, {
        programAdministratorName: newProgramName,
        programAdministratorContact: newProgramContact,
      });
      setNewSchoolName('');
      setNewProgramName('');
      setNewProgramContact('');
      await refreshMasterSchools();
      setSuccess(`Added school ${added}.`);
    } catch (err) {
      setSchoolListError(err.message || 'Failed to add school.');
    }
  };

  const handleRenameSchool = async () => {
    if (!user?.uid || !editingSchool) return;
    setSchoolListError('');
    const program = {
      programAdministratorName: editingSchool.programAdministratorName || '',
      programAdministratorContact: editingSchool.programAdministratorContact || '',
    };
    try {
      const nextName = (editingSchool.to || '').trim();
      const renamed = nextName !== editingSchool.from;
      if (renamed) {
        await renameMasterSchool(user.uid, editingSchool.from, editingSchool.to, program);
      } else {
        await updateMasterSchoolProgram(user.uid, editingSchool.from, program);
      }
      setEditingSchool(null);
      await refreshMasterSchools();
      setSuccess(renamed
        ? 'School name updated. Existing user and fit-test records keep the old name.'
        : 'Saved the program administrator fields for this school.');
    } catch (err) {
      setSchoolListError(err.message || 'Failed to update school.');
    }
  };

  const handleRemoveSchool = async (name) => {
    if (!user?.uid) return;
    const confirmed = window.confirm(
      `Remove ${name} from the school list?\n\nExisting user and fit-test records keep this name.`
    );
    if (!confirmed) return;
    setSchoolListError('');
    try {
      await removeMasterSchool(user.uid, name);
      if (editingSchool?.from === name) setEditingSchool(null);
      await refreshMasterSchools();
      setSuccess(`Removed ${name} from the school list. Existing records keep that name.`);
    } catch (err) {
      setSchoolListError(err.message || 'Failed to remove school.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="users-management-container">
        <div className="users-management-card">
          <h2 className="users-management-title">Users Management</h2>
          <p className="users-management-subtitle">
            Only admin users can access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="users-management-container">
      <div className="users-management-card">
        <div className="users-management-header">
          <div>
            <h2 className="users-management-title">Users Management</h2>
            <p className="users-management-subtitle">
              View, add, edit, and delete user profiles stored in Firebase.
            </p>
          </div>
          <div className="users-management-header-actions">
            <button
              type="button"
              className="users-secondary-button"
              onClick={() => {
                loadUsers();
                loadPendingUsers();
              }}
              disabled={loading || pendingLoading || creating}
            >
              {loading || pendingLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              className="users-primary-button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              disabled={loading || creating}
            >
              {showCreateForm ? 'Close Add Form' : 'Add User'}
            </button>
          </div>
        </div>

        {error && <div className="users-error">{error}</div>}
        {success && <div className="users-success">{success}</div>}

        {superAdmin && (
          <section className="form-section users-schools-section" aria-label="Master schools">
            <h3 className="section-title">Schools</h3>
            <p className="section-description">
              Master list of school names. Program administrator name and contact are optional.
              Sending an e-card copies them from the selected school. Renaming or removing a school does not change existing user or fit-test records.
            </p>
            {schoolListError && <div className="users-error">{schoolListError}</div>}
            <div className="solution-profile-list">
              {masterSchoolRecords.map((record) => {
                const name = record.name;
                const editing = editingSchool?.from === name;
                return (
                  <div
                    key={name}
                    className={`solution-profile-item${editing ? ' school-edit-open' : ''}`}
                  >
                    {editing ? (
                      <div className="school-edit-fields">
                        <input
                          className="users-search"
                          aria-label="Edit school name"
                          value={editingSchool.to}
                          onChange={(e) => setEditingSchool((prev) => ({ ...prev, to: e.target.value }))}
                        />
                        <input
                          className="users-search"
                          aria-label="Program administrator name"
                          placeholder="Program administrator name (optional)"
                          value={editingSchool.programAdministratorName || ''}
                          onChange={(e) => setEditingSchool((prev) => ({
                            ...prev,
                            programAdministratorName: e.target.value,
                          }))}
                        />
                        <input
                          className="users-search"
                          aria-label="Program administrator contact"
                          placeholder="Program administrator contact (optional)"
                          value={editingSchool.programAdministratorContact || ''}
                          onChange={(e) => setEditingSchool((prev) => ({
                            ...prev,
                            programAdministratorContact: e.target.value,
                          }))}
                        />
                      </div>
                    ) : (
                      <div className="solution-profile-details">
                        <strong>{name}</strong>
                      </div>
                    )}
                    <div className="solution-profile-actions">
                      {editing ? (
                        <button type="button" aria-label="Save school name" onClick={handleRenameSchool}>
                          Save
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label={`Edit ${name}`}
                            title="Edit"
                            onClick={() => setEditingSchool({
                              from: name,
                              to: name,
                              programAdministratorName: record.programAdministratorName || '',
                              programAdministratorContact: record.programAdministratorContact || '',
                            })}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${name}`}
                            title="Remove"
                            onClick={() => handleRemoveSchool(name)}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="school-add-fields">
              <input
                className="users-search"
                aria-label="New school name"
                placeholder="New school name"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
              />
              <input
                className="users-search"
                aria-label="New program administrator name"
                placeholder="Program administrator name (optional)"
                value={newProgramName}
                onChange={(e) => setNewProgramName(e.target.value)}
              />
              <input
                className="users-search"
                aria-label="New program administrator contact"
                placeholder="Program administrator contact (optional)"
                value={newProgramContact}
                onChange={(e) => setNewProgramContact(e.target.value)}
              />
            </div>
            <button type="button" className="solution-add-button" onClick={handleAddSchool}>
              + Add School
            </button>
          </section>
        )}

        {showCreateForm && (
          <form className="users-create-form" onSubmit={handleCreate}>
            <h3>Add User</h3>
            <p className="users-hint">
              Creates an account with a temporary password.
            </p>
            <div className="users-form-grid">
              <label>
                Email
                <input
                  type="email"
                  value={createForm.email}
                  aria-invalid={createFieldErrors.email ? true : undefined}
                  className={createFieldErrors.email ? 'field-invalid' : undefined}
                  onChange={(e) => setCreateValue('email', e.target.value)}
                  disabled={creating}
                />
                <FieldMessage message={createFieldErrors.email} />
              </label>
              <label>
                Temporary Password
                <input
                  type="password"
                  value={createForm.password}
                  aria-invalid={createFieldErrors.password ? true : undefined}
                  className={createFieldErrors.password ? 'field-invalid' : undefined}
                  onChange={(e) => setCreateValue('password', e.target.value)}
                  disabled={creating}
                />
                <FieldMessage message={createFieldErrors.password} />
              </label>
              <label>
                Name
                <input
                  type="text"
                  value={createForm.name}
                  aria-invalid={createFieldErrors.name ? true : undefined}
                  className={createFieldErrors.name ? 'field-invalid' : undefined}
                  onChange={(e) => setCreateValue('name', e.target.value)}
                  disabled={creating}
                />
                <FieldMessage message={createFieldErrors.name} />
              </label>
              <label>
                Program administrator name
                <input
                  type="text"
                  aria-label="Create program administrator name"
                  placeholder="Optional"
                  value={createForm.programAdministratorName}
                  onChange={(e) => setCreateForm((prev) => ({
                    ...prev,
                    programAdministratorName: e.target.value,
                  }))}
                  disabled={creating}
                />
              </label>
              <label>
                Program administrator contact
                <input
                  type="text"
                  aria-label="Create program administrator contact"
                  placeholder="Optional"
                  value={createForm.programAdministratorContact}
                  onChange={(e) => setCreateForm((prev) => ({
                    ...prev,
                    programAdministratorContact: e.target.value,
                  }))}
                  disabled={creating}
                />
              </label>
              <label>
                Role
                <select
                  aria-label="Role"
                  aria-invalid={createFieldErrors.role ? true : undefined}
                  className={createFieldErrors.role ? 'field-invalid' : undefined}
                  value={creatableRoles.includes(createForm.role) ? createForm.role : 'tester'}
                  onChange={(e) => setCreateValue('role', e.target.value)}
                  disabled={creating}
                >
                  {creatableRoles.filter((role) => role !== USER_ROLE_SUPERADMIN).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                  disabled={creating}
                >
                  {USER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              {creatingTester && superAdmin && (
                <label>
                  School
                  <select
                    aria-label="School"
                    value={createForm.school}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, school: e.target.value }))}
                    disabled={creating}
                  >
                    <option value="">Leave unset</option>
                    {masterSchools.map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {creatingTester && !superAdmin && actorSchools.length === 1 && (
                <label>
                  School
                  <div className="user-school-readonly" aria-label="School">
                    {actorSchools[0]}
                  </div>
                </label>
              )}
              {creatingTester && !superAdmin && actorSchools.length > 1 && (
                <label>
                  School
                  <select
                    aria-label="School"
                    required
                    value={createForm.school}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, school: e.target.value }))}
                    disabled={creating}
                  >
                    <option value="">Select a school</option>
                    {actorSchools.map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {creatingAdmin && (
                <SchoolCheckboxGroup
                  schools={masterSchools}
                  selected={normalizeSchoolList(createForm.schools)}
                  disabled={creating}
                  error={createFieldErrors.schools}
                  onChange={(schools) => setCreateValue('schools', schools)}
                />
              )}
            </div>
            {createBlocked && (
              <p className="users-error">{NO_SCHOOLS_CREATE_MESSAGE}</p>
            )}
            <button
              type="submit"
              className="users-primary-button"
              disabled={creating || createBlocked || createSchoolMissing}
            >
              {creating ? 'Creating...' : 'Create User'}
            </button>
          </form>
        )}

        <div className="users-view-tabs" role="tablist" aria-label="User lists">
          <button
            type="button"
            role="tab"
            aria-selected={rosterView === 'all'}
            className={`users-view-tab${rosterView === 'all' ? ' active' : ''}`}
            onClick={() => setRosterView('all')}
          >
            {'All users'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rosterView === 'pending'}
            className={`users-view-tab${rosterView === 'pending' ? ' active' : ''}`}
            onClick={() => setRosterView('pending')}
          >
            {'Pending approval'}
            {visiblePendingUsers.length > 0 ? (
              <span className="users-tab-count">{visiblePendingUsers.length}</span>
            ) : null}
          </button>
        </div>

        <div className="users-filters" hidden={rosterView !== 'all'}>
          <input
            type="search"
            className="users-search"
            placeholder="Search by name, email, or user ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            aria-label="Role filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All roles</option>
            {USER_ROLES.filter((role) => role !== USER_ROLE_SUPERADMIN).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {rosterView === 'pending' ? (
          <PendingApprovals
            users={visiblePendingUsers}
            loading={pendingLoading}
            error={pendingError}
            success={pendingSuccess}
            approvingId={approvingId}
            onApprove={(targetUserId) => handleApprovalAction(targetUserId, 'approved')}
            onReject={(targetUserId) => handleApprovalAction(targetUserId, 'rejected')}
          />
        ) : loading ? (
          <div className="users-empty">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="users-empty">No users match your filters.</div>
        ) : (
          <div className="users-list">
            {filteredUsers.map((item) => {
              const draft = editDrafts[item.id] || {};
              const isSelf = item.id === user.uid;
              const locked = !canModifyManagedUser(user?.role, item.role);
              const profileLocked = locked || !superAdmin;
              const currentRole = draft.role || item.role || 'tester';
              const roleIsSuperAdmin = currentRole === USER_ROLE_SUPERADMIN;
              const roleChoices = roleIsSuperAdmin
                ? []
                : locked
                  ? [currentRole]
                  : assignableRoles.filter((role) => role !== USER_ROLE_SUPERADMIN);
              const schoolTagIsList = currentRole === USER_ROLE_ADMIN;
              const schoolTagLabel = roleIsSuperAdmin || schoolTagIsList ? 'Schools' : 'School';
              const assignedSchools = normalizeSchoolList(draft.schools);
              const schoolTagValue = roleIsSuperAdmin
                ? 'All'
                : schoolTagIsList
                  ? assignedSchools.join(', ')
                  : (draft.school || '');
              const schoolChoices = withAssignedNames(
                masterSchools,
                (schoolTagIsList || roleIsSuperAdmin) ? assignedSchools : [draft.school || ''],
              );
              const canEditSchoolTags = superAdmin && !isSelf && !roleIsSuperAdmin;
              const canEditSuperAdminSchools = superAdmin && !isSelf && roleIsSuperAdmin;
              const statusPill = accountStatusLabel(item);
              const cardErrors = editFieldErrors[item.id] || {};
              return (
                <article key={item.id} className="user-card">
                  <div className="user-card-top">
                    <div>
                      <h3>{item.name || 'Unnamed user'}</h3>
                      <p className="user-tester-line">
                        Tester name: <strong>{item.name || '—'}</strong>
                      </p>
                      <p className="user-test-count">
                        Test Results: <strong>{testCounts[item.id] || 0}</strong>
                      </p>
                      <p className="user-id">UID: {item.id}</p>
                    </div>
                    <div className="user-badges">
                      <span className={`user-badge role-${item.role}`}>{item.role}</span>
                      <span
                        className={`user-badge status-pill ${statusPill.statusClass}`}
                        aria-label="Account status"
                      >
                        {statusPill.label}
                      </span>
                      {isSelf && <span className="user-badge you">You</span>}
                      {locked && <span className="user-badge role-admin">Super admin only</span>}
                    </div>
                  </div>

                  <div className="users-form-grid">
                    <label>
                      Name
                      <input
                        type="text"
                        value={draft.name || ''}
                        aria-invalid={cardErrors.name ? true : undefined}
                        className={cardErrors.name ? 'field-invalid' : undefined}
                        onChange={(e) => handleDraftChange(item.id, 'name', e.target.value)}
                        disabled={profileLocked || savingId === item.id}
                      />
                      <FieldMessage message={cardErrors.name} />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={draft.email || ''}
                        aria-invalid={cardErrors.email ? true : undefined}
                        className={cardErrors.email ? 'field-invalid' : undefined}
                        onChange={(e) => handleDraftChange(item.id, 'email', e.target.value)}
                        disabled={profileLocked || savingId === item.id}
                      />
                      <FieldMessage message={cardErrors.email} />
                    </label>
                    <label>
                      Program administrator name
                      <input
                        type="text"
                        aria-label="Program administrator name"
                        placeholder="Optional"
                        value={draft.programAdministratorName || ''}
                        onChange={(e) => handleDraftChange(item.id, 'programAdministratorName', e.target.value)}
                        disabled={locked || savingId === item.id}
                      />
                    </label>
                    <label>
                      Program administrator contact
                      <input
                        type="text"
                        aria-label="Program administrator contact"
                        placeholder="Optional"
                        value={draft.programAdministratorContact || ''}
                        onChange={(e) => handleDraftChange(item.id, 'programAdministratorContact', e.target.value)}
                        disabled={locked || savingId === item.id}
                      />
                    </label>
                    <label>
                      Role
                      {roleIsSuperAdmin ? (
                        <div className="user-role-readonly">{currentRole}</div>
                      ) : (
                        <select
                          aria-label="Role"
                          aria-invalid={cardErrors.role ? true : undefined}
                          className={cardErrors.role ? 'field-invalid' : undefined}
                          value={currentRole}
                          onChange={(e) => handleDraftChange(item.id, 'role', e.target.value)}
                          disabled={locked || savingId === item.id || isSelf}
                        >
                          {roleChoices.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                    <label>
                      Status
                      <select
                        value={draft.status || 'pending'}
                        onChange={(e) => handleDraftChange(item.id, 'status', e.target.value)}
                        disabled={locked || savingId === item.id || isSelf}
                      >
                        {USER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    {roleIsSuperAdmin ? (
                      <>
                        <label>
                          Schools
                          <div className="user-school-readonly" aria-label="Schools">All</div>
                        </label>
                        {canEditSuperAdminSchools && (
                          <SchoolCheckboxGroup
                            schools={schoolChoices}
                            selected={assignedSchools}
                            disabled={savingId === item.id}
                            onChange={(schools) => handleDraftChange(item.id, 'schools', schools)}
                          />
                        )}
                      </>
                    ) : canEditSchoolTags && schoolTagIsList ? (
                      <SchoolCheckboxGroup
                        schools={schoolChoices}
                        selected={assignedSchools}
                        disabled={savingId === item.id}
                        error={cardErrors.schools}
                        onChange={(schools) => handleDraftChange(item.id, 'schools', schools)}
                      />
                    ) : (
                      <label>
                        {schoolTagLabel}
                        {canEditSchoolTags ? (
                          <select
                            aria-label="School"
                            value={draft.school || ''}
                            onChange={(e) => handleDraftChange(item.id, 'school', e.target.value)}
                            disabled={savingId === item.id}
                          >
                            <option value="">Leave unset</option>
                            {schoolChoices.map((school) => (
                              <option key={school} value={school}>{school}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="user-school-readonly" aria-label={schoolTagLabel}>
                            {schoolTagValue.trim() || '—'}
                          </div>
                        )}
                      </label>
                    )}
                    {superAdmin && !isSelf && currentRole === USER_ROLE_ADMIN && (
                      <>
                        <label>
                          Access start
                          <input
                            type="date"
                            aria-label="Access start"
                            value={draft.startDate || ''}
                            onChange={(e) => handleDraftChange(item.id, 'startDate', e.target.value)}
                            disabled={savingId === item.id}
                          />
                        </label>
                        <label>
                          Access end
                          <input
                            type="date"
                            aria-label="Access end"
                            value={draft.endDate || ''}
                            onChange={(e) => handleDraftChange(item.id, 'endDate', e.target.value)}
                            disabled={savingId === item.id}
                          />
                        </label>
                      </>
                    )}
                  </div>

                  <div className="user-meta">
                    <div><strong>Provider:</strong> {item.provider || '—'}</div>
                    <div><strong>Created:</strong> {formatDate(item.createdAt)}</div>
                    <div><strong>Requested:</strong> {formatDate(item.requestedAt)}</div>
                    <div><strong>Updated:</strong> {formatDate(item.updatedAt)}</div>
                    <div><strong>Approved At:</strong> {formatDate(item.approvedAt)}</div>
                    <div><strong>Approved By:</strong> {item.approvedBy || '—'}</div>
                  </div>

                  <div className="user-card-actions">
                    <button
                      type="button"
                      className="users-primary-button"
                      onClick={() => handleSave(item.id)}
                      disabled={locked || savingId === item.id || deletingId === item.id}
                    >
                      {savingId === item.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="users-danger-button"
                      onClick={() => handleDelete(item)}
                      disabled={locked || isSelf || savingId === item.id || deletingId === item.id}
                    >
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersManagement;
