import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ResultCardEditForm from './ResultCardEditForm';

const selects = (renderer) => {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'select') found.push(node);
    (Array.isArray(node.children) ? node.children : []).forEach(walk);
  };
  walk(renderer.toJSON());
  return found;
};

const testingAgentSelect = (renderer) => selects(renderer).find((select) => (
  (select.children || []).some((child) => child?.props?.value === 'Bitrex')
));

const styleSelect = (renderer) => renderer.root.findAllByType('select').find((node) => (
  node.findAllByType('option').some((option) => option.children && option.children.includes('Select style'))
));

const renderForm = (editData, editError) => {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(
      <ResultCardEditForm
        editData={editData}
        onChange={() => {}}
        isCustomEditLocation={false}
        editError={editError}
      />
    );
  });
  return renderer;
};

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
  act(() => {
    renderer.unmount();
  });
});

test('the edit form does not default a missing testing agent to Bitrex', () => {
  const renderer = renderForm({ testingAgent: '' });
  const select = testingAgentSelect(renderer);
  expect(select.props.value).toBe('');
  expect(select.children[0].props.value).toBe('');
  expect(select.children[0].children).toEqual(['Select testing agent']);
  act(() => {
    renderer.unmount();
  });
});

test('the edit form keeps a testing agent the record already has', () => {
  const renderer = renderForm({ testingAgent: 'Saccharin' });
  expect(testingAgentSelect(renderer).props.value).toBe('Saccharin');
  act(() => {
    renderer.unmount();
  });
});
