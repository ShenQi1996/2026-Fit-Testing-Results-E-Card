import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  USER_ROLES,
  USER_STATUSES,
  getAllUsers,
  getFitTestCountsByUser,
  updateManagedUser,
  deleteManagedUser,
} from '../../services/firebaseDb';
import { createManagedAuthUser } from '../../services/firebaseAuth';
import './UsersManagement.css';

const EMPTY_CREATE_FORM = {
  email: '',
  password: '',
  name: '',
  role: 'tester',
  status: 'approved',
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch (error) {
    return iso;
  }
};

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

  const isAdmin = user?.role === 'admin';

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
          status: item.status || 'approved',
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

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (roleFilter !== 'all' && item.role !== roleFilter) return false;
      if (!term) return true;
      return (
        item.name?.toLowerCase().includes(term) ||
        item.email?.toLowerCase().includes(term) ||
        item.id?.toLowerCase().includes(term)
      );
    });
  }, [users, search, statusFilter, roleFilter]);

  const handleDraftChange = (userId, field, value) => {
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
    setSavingId(targetUserId);
    setError('');
    setSuccess('');
    try {
      const draft = editDrafts[targetUserId] || {};
      const updated = await updateManagedUser(user.uid, targetUserId, draft);
      setUsers((prev) => prev.map((item) => (item.id === targetUserId ? updated : item)));
      setEditDrafts((prev) => ({
        ...prev,
        [targetUserId]: {
          name: updated.name || '',
          email: updated.email || '',
          role: updated.role || 'tester',
          status: updated.status || 'approved',
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
      `Delete user profile for ${label}?\n\nThis removes their Firestore profile and app access. Their Firebase Auth login may still exist.`
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

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;

    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const created = await createManagedAuthUser(user.uid, createForm);
      setUsers((prev) => [created, ...prev]);
      setEditDrafts((prev) => ({
        ...prev,
        [created.id]: {
          name: created.name || '',
          email: created.email || '',
          role: created.role || 'tester',
          status: created.status || 'approved',
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
              onClick={loadUsers}
              disabled={loading || creating}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
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
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={creating}
                />
              </label>
              <label>
                Temporary Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                  disabled={creating}
                />
              </label>
              <label>
                Name
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={creating}
                />
              </label>
              <label>
                Role
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                  disabled={creating}
                >
                  {USER_ROLES.map((role) => (
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
            </div>
            <button type="submit" className="users-primary-button" disabled={creating}>
              {creating ? 'Creating...' : 'Create User'}
            </button>
          </form>
        )}

        <div className="users-filters">
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
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="users-empty">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="users-empty">No users match your filters.</div>
        ) : (
          <div className="users-list">
            {filteredUsers.map((item) => {
              const draft = editDrafts[item.id] || {};
              const isSelf = item.id === user.uid;
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
                      <span className={`user-badge status-${item.status}`}>{item.status}</span>
                      {isSelf && <span className="user-badge you">You</span>}
                    </div>
                  </div>

                  <div className="users-form-grid">
                    <label>
                      Name
                      <input
                        type="text"
                        value={draft.name || ''}
                        onChange={(e) => handleDraftChange(item.id, 'name', e.target.value)}
                        disabled={savingId === item.id}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={draft.email || ''}
                        onChange={(e) => handleDraftChange(item.id, 'email', e.target.value)}
                        disabled={savingId === item.id}
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={draft.role || 'tester'}
                        onChange={(e) => handleDraftChange(item.id, 'role', e.target.value)}
                        disabled={savingId === item.id || isSelf}
                      >
                        {USER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={draft.status || 'approved'}
                        onChange={(e) => handleDraftChange(item.id, 'status', e.target.value)}
                        disabled={savingId === item.id || isSelf}
                      >
                        {USER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
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
                      disabled={savingId === item.id || deletingId === item.id}
                    >
                      {savingId === item.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="users-danger-button"
                      onClick={() => handleDelete(item)}
                      disabled={isSelf || savingId === item.id || deletingId === item.id}
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
