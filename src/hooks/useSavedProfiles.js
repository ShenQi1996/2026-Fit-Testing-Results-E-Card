import { useCallback, useEffect, useState } from 'react';
import { formatDateInput } from '../utils/dateUtils';

export const useSavedProfiles = ({
  userId,
  fetchAll,
  save,
  remove,
  reorder,
  setDefault,
  emptyForm,
  toPayload,
  dateFields = [],
}) => {
  const [profiles, setProfiles] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      setProfiles(await fetchAll(userId));
    } catch (err) {
      setError(err.message || 'Failed to load saved profiles.');
    } finally {
      setLoading(false);
    }
  }, [fetchAll, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = dateFields.includes(name) ? formatDateInput(value) : value;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : nextValue,
    }));
    setError('');
    setSuccess('');
  };

  const handleAdd = async (e, validate, successMessage) => {
    e.preventDefault();
    if (!userId) return;
    setError('');
    setSuccess('');

    const validationError = validate(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await save(userId, toPayload(formData), formData.setAsDefault);
      setFormData(emptyForm);
      setSuccess(successMessage);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to add profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (profileId, successMessage) => {
    if (!userId) return;
    setError('');
    setSuccess('');
    try {
      await remove(userId, profileId);
      setSuccess(successMessage);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete profile.');
    }
  };

  const handleMove = async (currentIndex, direction, successMessage) => {
    if (!userId) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= profiles.length) return;

    const reordered = [...profiles];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[nextIndex];
    reordered[nextIndex] = temp;

    setProfiles(reordered);
    setError('');
    setSuccess('');

    try {
      await reorder(userId, reordered.map((profile) => profile.id));
      setSuccess(successMessage);
    } catch (err) {
      setError(err.message || 'Failed to reorder profiles.');
      await load();
    }
  };

  const handleSetDefault = async (profileId, successMessage) => {
    if (!userId) return;
    setError('');
    setSuccess('');
    try {
      await setDefault(userId, profileId);
      setSuccess(successMessage);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to set default profile.');
    }
  };

  return {
    profiles,
    formData,
    loading,
    saving,
    error,
    success,
    handleChange,
    handleAdd,
    handleDelete,
    handleMove,
    handleSetDefault,
  };
};
