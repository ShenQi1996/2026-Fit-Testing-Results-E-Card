import React from 'react';

const SavedProfilesPanel = ({
  title,
  description,
  error,
  success,
  fields,
  formData,
  onChange,
  onAdd,
  addLabel,
  savingLabel,
  saving,
  disabled,
  profiles,
  loading,
  loadingLabel,
  emptyLabel,
  renderDetails,
  onMove,
  onSetDefault,
  onDelete,
}) => (
  <div className="form-section">
    <h3 className="section-title">{title}</h3>
    <p className="section-description">{description}</p>

    {error && <div className="auth-error">{error}</div>}
    {success && <div className="auth-success">{success}</div>}

    <div className={`solution-profile-add-grid${fields.length === 1 ? ' school-profile-add-grid' : ''}`}>
      {fields.map((field) => (
        <div className="form-group" key={field.name}>
          <label htmlFor={field.id || field.name}>{field.label}</label>
          <input
            type="text"
            id={field.id || field.name}
            name={field.name}
            className="form-input"
            placeholder={field.placeholder}
            value={formData[field.name] || ''}
            onChange={onChange}
            inputMode={field.date ? 'numeric' : undefined}
            maxLength={field.date ? 10 : undefined}
            disabled={saving || disabled}
          />
        </div>
      ))}
    </div>

    <div className="form-group solution-default-toggle">
      <label htmlFor={fields[0]?.defaultId || 'setAsDefault'}>
        <input
          type="checkbox"
          id={fields[0]?.defaultId || 'setAsDefault'}
          name="setAsDefault"
          checked={Boolean(formData.setAsDefault)}
          onChange={onChange}
          disabled={saving || disabled}
        />
        {fields[0]?.defaultLabel || 'Set as new default'}
      </label>
    </div>

    <button
      type="button"
      className="solution-add-button"
      onClick={onAdd}
      disabled={saving || disabled}
    >
      {saving ? savingLabel : addLabel}
    </button>

    <div className="solution-profile-list">
      {loading ? (
        <div className="solution-empty">{loadingLabel}</div>
      ) : profiles.length === 0 ? (
        <div className="solution-empty">{emptyLabel}</div>
      ) : (
        profiles.map((profile, index) => (
          <div key={profile.id} className="solution-profile-item">
            <div className="solution-profile-details">
              {renderDetails(profile)}
              {profile.isDefault && <span className="solution-default-badge">Default</span>}
            </div>
            <div className="solution-profile-actions">
              <button
                type="button"
                onClick={() => onMove(index, -1)}
                disabled={index === 0 || disabled}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMove(index, 1)}
                disabled={index === profiles.length - 1 || disabled}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onSetDefault(profile.id)}
                disabled={profile.isDefault || disabled}
                title="Set as default"
              >
                ⭐
              </button>
              <button
                type="button"
                onClick={() => onDelete(profile.id)}
                disabled={disabled}
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
);

export default SavedProfilesPanel;
