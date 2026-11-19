import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import { getFacultyFitTests, getUserFitTestsPage } from '../../services/firebaseDb';
import { notifyFitTestActivity } from '../../utils/fitTestActivity';
import { clearFitTestListStore } from '../../services/fitTestListStore';
import Sidebar from './Sidebar';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/firebaseDb', () => ({
  TESTER_RESULTS_PAGE_SIZE: 25,
  getUserFitTestsPage: jest.fn(() => Promise.resolve({
    records: [{ id: 'ft-1' }, { id: 'ft-2' }],
    hasMore: false,
    cursor: null,
  })),
  getFacultyFitTests: jest.fn(() => Promise.resolve([
    { id: 'ft-a' },
    { id: 'ft-b' },
    { id: 'ft-c' },
    { id: 'ft-d' },
  ])),
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

const updatePage = async (renderer, currentPage) => {
  await act(async () => {
    renderer.update(
      <Sidebar currentPage={currentPage} onNavigate={() => {}} isOpen={false} />
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  clearFitTestListStore();
  useAuth.mockReturnValue({ user: { uid: 'tester-1', role: 'tester' } });
});

test('the sidebar recounts after a fit test is saved and skips navigation refetch', async () => {
  const renderer = await renderSidebar('form');

  expect(getUserFitTestsPage).toHaveBeenCalledTimes(1);
  expect(getUserFitTestsPage).toHaveBeenCalledWith('tester-1', expect.objectContaining({
    limit: 25,
  }));
  expect(JSON.stringify(renderer.toJSON())).toContain('Test results (2)');

  await updatePage(renderer, 'results');
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(1);

  await act(async () => {
    notifyFitTestActivity();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(getUserFitTestsPage).toHaveBeenCalledTimes(2);
});

test('faculty see results only and count by school', async () => {
  useAuth.mockReturnValue({
    user: { uid: 'faculty-1', role: 'faculty', school: 'Helene College of Nursing', schools: [] },
  });
  const renderer = await renderSidebar('results');
  const json = JSON.stringify(renderer.toJSON());
  expect(json).not.toContain('Send e-card');
  expect(json).not.toContain('Users');
  expect(json).toContain('Test results (4)');
  expect(getFacultyFitTests).toHaveBeenCalledWith(expect.objectContaining({
    role: 'faculty',
    school: 'Helene College of Nursing',
  }), {});
  expect(getUserFitTestsPage).not.toHaveBeenCalled();
});
