import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import { getPendingUsers, updateUserApprovalStatus } from '../../services/firebaseDb';
import EditAccount from './EditAccount';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/firebaseDb', () => ({
  getUserSolutionProfiles: jest.fn(() => Promise.resolve([])),
  saveUserSolutionProfile: jest.fn(),
  deleteUserSolutionProfile: jest.fn(),
  reorderUserSolutionProfiles: jest.fn(),
  setDefaultSolutionProfile: jest.fn(),
  getUserSchoolProfiles: jest.fn(() => Promise.resolve([])),
  saveUserSchoolProfile: jest.fn(),
  deleteUserSchoolProfile: jest.fn(),
  reorderUserSchoolProfiles: jest.fn(),
  setDefaultSchoolProfile: jest.fn(),
  getPendingUsers: jest.fn(() => Promise.resolve([])),
  updateUserApprovalStatus: jest.fn(),
}));

const treeText = (renderer) => JSON.stringify(renderer.toJSON());

const renderAccount = async (role) => {
  useAuth.mockReturnValue({
    user: {
      uid: 'admin-1',
      role,
      name: 'Ada',
      email: 'ada@example.com',
    },
    updateUser: jest.fn(),
  });
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<EditAccount onBack={() => {}} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return renderer;
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('account settings does not render pending approvals', async () => {
  const renderer = await renderAccount('admin');
  const text = treeText(renderer);

  expect(text).toContain('Edit Account');
  expect(text).toContain('Update Account');
  expect(text).toContain('You have admin privileges');
  expect(text).not.toContain('Pending User Approvals');
  expect(text).not.toContain('Refresh Pending Users');
  expect(text).not.toContain('Loading pending approvals');
  expect(text).not.toContain('No pending users');
  expect(getPendingUsers).not.toHaveBeenCalled();
  expect(updateUserApprovalStatus).not.toHaveBeenCalled();

  const superAdmin = await renderAccount('superadmin');
  const superText = treeText(superAdmin);
  expect(superText).toContain('You are a super admin');
  expect(superText).not.toContain('Pending User Approvals');
  expect(getPendingUsers).not.toHaveBeenCalled();
});
