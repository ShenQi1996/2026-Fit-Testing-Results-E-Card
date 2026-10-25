import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import { countFacultyFitTests, countFitTestsForUser } from '../../services/firebaseDb';
import { notifyFitTestActivity } from '../../utils/fitTestActivity';
import Sidebar, { SIDEBAR_COUNT_CACHE_MS } from './Sidebar';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/firebaseDb', () => ({
  countFitTestsForUser: jest.fn(() => Promise.resolve(2)),
  countFacultyFitTests: jest.fn(() => Promise.resolve(4)),
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
  useAuth.mockReturnValue({ user: { uid: 'tester-1', role: 'tester' } });
});

test('the sidebar recounts after a fit test is saved and skips navigation inside 30 seconds', async () => {
  expect(SIDEBAR_COUNT_CACHE_MS).toBe(30 * 1000);
  const now = jest.spyOn(Date, 'now');
  let clock = 1_700_000_000_000;
  now.mockImplementation(() => clock);

  try {
    const renderer = await renderSidebar('form');

    expect(countFitTestsForUser).toHaveBeenCalledTimes(1);
    expect(countFitTestsForUser).toHaveBeenCalledWith('tester-1');
    expect(JSON.stringify(renderer.toJSON())).toContain('Test results (2)');

    await updatePage(renderer, 'results');
    expect(countFitTestsForUser).toHaveBeenCalledTimes(1);

    await act(async () => {
      notifyFitTestActivity();
      await Promise.resolve();
    });
    expect(countFitTestsForUser).toHaveBeenCalledTimes(2);

    clock += SIDEBAR_COUNT_CACHE_MS;
    await updatePage(renderer, 'form');
    expect(countFitTestsForUser).toHaveBeenCalledTimes(3);
  } finally {
    now.mockRestore();
  }
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
  expect(countFacultyFitTests).toHaveBeenCalledWith(expect.objectContaining({
    role: 'faculty',
    school: 'Helene College of Nursing',
  }));
  expect(countFitTestsForUser).not.toHaveBeenCalled();
});
