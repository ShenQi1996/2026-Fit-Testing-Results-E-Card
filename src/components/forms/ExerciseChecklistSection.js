import React from 'react';
import FormSection from '../common/FormSection';
import FormCheckbox from '../common/FormCheckbox';

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
    <FormSection title="Required exercises">
      {EXERCISE_CHECKLIST_ITEMS.map((item) => (
        <FormCheckbox
          key={item.id}
          id={item.id}
          checked={formData[item.id] !== undefined ? formData[item.id] : true}
          onChange={(checked) => onChange(item.id, checked)}
          disabled={isLoading}
          error={fieldErrors?.[item.id]}
        >
          {item.label}
        </FormCheckbox>
      ))}
    </FormSection>
  );
};

export default ExerciseChecklistSection;
