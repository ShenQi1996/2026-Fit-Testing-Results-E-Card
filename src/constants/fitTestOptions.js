export const TESTING_AGENT_OPTIONS = [
  { value: 'Bitrex', label: 'Bitrex' },
  { value: 'Saccharin', label: 'Saccharin' },
  { value: 'Isoamyl Acetate', label: 'Isoamyl Acetate' },
];

export const TEST_LOCATION_OPTIONS = [
  { value: 'Harlem', label: 'Harlem' },
  { value: 'Brooklyn', label: 'Brooklyn' },
  { value: 'Other', label: 'Other' },
];

export const SCHOOLS_OPTIONS = [
  { value: 'Helene College of Nursing', label: 'Helene College of Nursing' },
];

export const FIT_TEST_TYPE_OPTIONS = [
  { value: 'N95', label: 'N95' },
  { value: 'N99', label: 'N99' },
  { value: 'N100', label: 'N100' },
  { value: 'P100', label: 'P100' },
  { value: 'Half Face', label: 'Half Face' },
  { value: 'Full Face', label: 'Full Face' },
];

export const RESPIRATOR_MFG_OPTIONS = [
  { value: '3M', label: '3M' },
  { value: 'Honeywell', label: 'Honeywell' },
  { value: 'Moldex', label: 'Moldex' },
  { value: 'Kimberly-Clark', label: 'Kimberly-Clark' },
  { value: 'Other', label: 'Other' },
];

export const MASK_SIZE_OPTIONS = [
  { value: 'Small', label: 'Small' },
  { value: 'Regular', label: 'Regular' },
  { value: 'Large', label: 'Large' },
];

export const RESULT_OPTIONS = [
  { value: 'Pass', label: 'Pass' },
  { value: 'Fail', label: 'Fail' },
];

export const FIT_TEST_METHOD_OPTIONS = [
  { value: 'Locked to Qualitative', label: 'Locked to Qualitative' },
];

export const CLEANING_METHOD_OPTIONS = [
  { value: 'Condition acceptable', label: 'Condition acceptable' },
  { value: 'Removed from service', label: 'Removed from service' },
];

export const FAILURE_REASON_OPTIONS = [
  { value: 'Improper seal', label: 'Improper seal' },
  { value: 'Taste detected', label: 'Taste detected' },
  { value: 'Respirator movement', label: 'Respirator movement' },
  { value: 'Other', label: 'Other' },
];

export const EXERCISE_CHECKLIST_ITEMS = [
  { id: 'exerciseNormalBreathing', label: 'Normal breathing' },
  { id: 'exerciseDeepBreathing', label: 'Deep breathing' },
  { id: 'exerciseHeadSideToSide', label: 'Head side to side' },
  { id: 'exerciseHeadUpAndDown', label: 'Head up and down' },
  { id: 'exerciseTalking', label: 'Talking' },
  { id: 'exerciseBendingOverOrJogging', label: 'Bending over, or jogging in place' },
  { id: 'exerciseNormalBreathingAgain', label: 'Normal breathing again' },
];

export const isKnownOptionValue = (value, options) =>
  Boolean(value) && options.some((option) => option.value === value);

export const isCustomOptionValue = (value, options) =>
  Boolean(value) && !options.some((option) => option.value === value);
