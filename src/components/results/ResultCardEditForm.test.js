import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ResultCardEditForm from './ResultCardEditForm';

const testingAgentSelect = (root) => root.findAllByType('select').find((node) => (
  node.findAllByType('option').some((option) => option.props.value === 'Bitrex')
));

test('the edit form does not default a missing testing agent to Bitrex', () => {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(
      <ResultCardEditForm
        editData={{ testingAgent: '' }}
        onChange={() => {}}
        isCustomEditLocation={false}
      />
    );
  });

  const select = testingAgentSelect(renderer.root);
  expect(select.props.value).toBe('');
  expect(select.findByProps({ value: '' }).children).toEqual(['Select testing agent']);

  act(() => {
    renderer.unmount();
  });
});

test('the edit form keeps a testing agent the record already has', () => {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(
      <ResultCardEditForm
        editData={{ testingAgent: 'Saccharin' }}
        onChange={() => {}}
        isCustomEditLocation={false}
      />
    );
  });

  expect(testingAgentSelect(renderer.root).props.value).toBe('Saccharin');

  act(() => {
    renderer.unmount();
  });
});
