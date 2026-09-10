import { useCallback, useEffect, useState } from 'react';

export const useSelectableProfiles = ({
  userId,
  newOptionValue,
  basePrefix,
  profilePrefix,
  baseOptions,
  getDefaultBaseValue,
  fetchProfiles,
  buildSavedLabel,
  formatBaseLabel,
  newOptionLabel,
  emptyFormFields,
  fieldsFromBase,
  fieldsFromProfile,
  setFormData,
  setStatus,
  loadWarning,
  applyBaseWhenNoDefault = false,
}) => {
  const [profiles, setProfiles] = useState([]);
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(`${basePrefix}${getDefaultBaseValue()}`);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const buildOptions = useCallback((nextProfiles) => {
    const savedProfileOptions = nextProfiles.map((profile) => ({
      value: `${profilePrefix}${profile.id}`,
      label: buildSavedLabel(profile),
    }));

    const prefixedBaseOptions = baseOptions.map((option) => ({
      value: `${basePrefix}${option.value}`,
      label: formatBaseLabel(option),
    }));

    return [
      ...savedProfileOptions,
      ...prefixedBaseOptions,
      { value: newOptionValue, label: newOptionLabel },
    ];
  }, [baseOptions, basePrefix, buildSavedLabel, formatBaseLabel, newOptionLabel, newOptionValue, profilePrefix]);

  const applySelection = useCallback((optionValue, profilesToUse = profiles) => {
    setSelectedOption(optionValue);

    if (optionValue === newOptionValue) {
      setFormData((prev) => ({ ...prev, ...emptyFormFields }));
      return;
    }

    if (optionValue.startsWith(basePrefix)) {
      const baseValue = optionValue.replace(basePrefix, '');
      setFormData((prev) => ({ ...prev, ...fieldsFromBase(baseValue) }));
      return;
    }

    if (optionValue.startsWith(profilePrefix)) {
      const profileId = optionValue.replace(profilePrefix, '');
      const profile = profilesToUse.find((item) => item.id === profileId);
      if (profile) {
        setFormData((prev) => ({ ...prev, ...fieldsFromProfile(profile) }));
      }
    }
  }, [basePrefix, emptyFormFields, fieldsFromBase, fieldsFromProfile, newOptionValue, profilePrefix, profiles, setFormData]);

  const loadProfiles = useCallback(async (nextUserId) => {
    if (!nextUserId) {
      setProfiles([]);
      setOptions(buildOptions([]));
      return [];
    }

    setIsLoading(true);
    try {
      const nextProfiles = await fetchProfiles(nextUserId);
      setProfiles(nextProfiles);
      setOptions(buildOptions(nextProfiles));
      return nextProfiles;
    } catch (error) {
      console.error(loadWarning, error);
      setStatus({ type: 'warning', message: error?.message || loadWarning });
      setProfiles([]);
      setOptions(buildOptions([]));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [buildOptions, fetchProfiles, loadWarning, setStatus]);

  useEffect(() => {
    const initialize = async () => {
      if (!userId) {
        setProfiles([]);
        setOptions(buildOptions([]));
        if (applyBaseWhenNoDefault) {
          applySelection(`${basePrefix}${getDefaultBaseValue()}`, []);
        } else {
          setSelectedOption(`${basePrefix}${getDefaultBaseValue()}`);
        }
        return;
      }

      const nextProfiles = await loadProfiles(userId);
      const defaultProfile = nextProfiles.find((profile) => profile.isDefault);

      if (defaultProfile) {
        applySelection(`${profilePrefix}${defaultProfile.id}`, nextProfiles);
      } else if (applyBaseWhenNoDefault) {
        applySelection(`${basePrefix}${getDefaultBaseValue()}`, nextProfiles);
      } else {
        setSelectedOption(`${basePrefix}${getDefaultBaseValue()}`);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleOptionChange = (optionValue) => {
    setSetAsDefault(false);
    applySelection(optionValue);
  };

  return {
    profiles,
    options,
    selectedOption,
    setSelectedOption,
    setAsDefault,
    setSetAsDefault,
    isLoading,
    isAddingNew: selectedOption === newOptionValue,
    applySelection,
    loadProfiles,
    handleOptionChange,
    newOptionValue,
    profilePrefix,
    basePrefix,
  };
};
