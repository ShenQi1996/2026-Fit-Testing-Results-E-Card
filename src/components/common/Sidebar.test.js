import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import { countFitTestsForUser } from '../../services/firebaseDb';
import { notifyFitTestActivity } from '../../utils/fitTestActivity';
import Sidebar from './Sidebar';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/firebaseDb', () => ({
  countFitTestsForUser: jest.fn(() => Promise.resolve(2)),
}));

const renderSidebar = async (currentPage) => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <Sidebar currentPage={currentPage} onNavigate={() => {}} isOpen={false} />
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return renderer;
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { uid: 'tester-1', role: 'tester' } });
});

test('the sidebar recounts when the page changes and after a fit test is saved', async () => {
  const renderer = await renderSidebar('form');

  expect(countFitTestsForUser).toHaveBeenCalledTimes(1);
  expect(countFitTestsForUser).toHaveBeenCalledWith('tester-1');
  expect(JSON.stringify(renderer.toJSON())).toContain('Test results (2)');

  await act(async () => {
    renderer.update(
      <Sidebar currentPage="results" onNavigate={() => {}} isOpen={false} />
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(countFitTestsForUser).toHaveBeenCalledTimes(2);

  await act(async () => {
    notifyFitTestActivity();
    await Promise.resolve();
  });
  expect(countFitTestsForUser).toHaveBeenCalledTimes(3);
});
