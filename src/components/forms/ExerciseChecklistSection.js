import React from 'react';
import FormSection from '../common/FormSection';
import FormCheckbox from '../common/FormCheckbox';
import { EXERCISE_CHECKLIST_ITEMS } from '../../constants/fitTestOptions';

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
