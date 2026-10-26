import React from 'react';
import TestRenderer from 'react-test-renderer';
import ResultCardEditForm from './ResultCardEditForm';

const renderForm = (editData, editError) => TestRenderer.create(
  <ResultCardEditForm
    editData={editData}
    onChange={() => {}}
    isCustomEditLocation={false}
    editError={editError}
  />
);

const styleSelect = (renderer) => renderer.root.findAllByType('select').find((node) => (
  node.findAllByType('option').some((option) => option.children && option.children.includes('Select style'))
));

test('a legacy edit with no style shows the message on the style field', () => {
  const renderer = renderForm({
    style: '',
    testLocation: 'Harlem',
  }, 'Please select the respirator style.');

  const select = styleSelect(renderer);
  expect(select.props.className).toContain('form-input-error');
  expect(select.props['aria-invalid']).toBe('true');
  expect(select.props['aria-describedby']).toBe('edit-style-error');
  expect(renderer.root.findByProps({ id: 'edit-style-error' }).children).toEqual([
    'Please select the respirator style.',
  ]);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Fit Factor');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Fit Test Method');
});
