import React from 'react';
import FormSection from '../common/FormSection';

const EXERCISE_CHECKLIST_ITEMS = [
  { id: 'exerciseNormalBreathing', label: 'Normal breathing' },
  { id: 'exerciseDeepBreathing', label: 'Deep breathing' },
  { id: 'exerciseHeadSideToSide', label: 'Head side to side' },
  { id: 'exerciseHeadUpAndDown', label: 'Head up and down' },
  { id: 'exerciseTalking', label: 'Talking' },
  { id: 'exerciseBendingOverOrJogging', label: 'Bending over, or jogging in place' },
  { id: 'exerciseNormalBreathingAgain', label: 'Normal breathing again' },
];

const ExerciseChecklistSection = ({ formData, onChange, isLoading, fieldErrors }) => {
  return (
    <FormSection title="Required exercise checklist">
      {EXERCISE_CHECKLIST_ITEMS.map((item) => (
        <div key={item.id} className="form-group">
          <label htmlFor={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id={item.id}
              checked={formData[item.id] !== undefined ? formData[item.id] : true}
              onChange={(e) => onChange(item.id, e.target.checked)}
              disabled={isLoading}
              style={{
                width: '18px',
                height: '18px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                accentColor: 'var(--accent-teal)',
              }}
            />
            <span>{item.label}</span>
          </label>
          {fieldErrors?.[item.id] && (
            <span className="form-error-message">{fieldErrors[item.id]}</span>
          )}
        </div>
      ))}
    </FormSection>
  );
};

export default ExerciseChecklistSection;
