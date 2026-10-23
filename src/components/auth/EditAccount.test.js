import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import { getPendingUsers, updateUserApprovalStatus } from '../../services/firebaseDb';
import { listMasterSchools } from '../../services/masterSchools';
import EditAccount from './EditAccount';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/masterSchools', () => ({
  listMasterSchools: jest.fn(() => Promise.resolve([
    'Helene College of Nursing',
    'Example Second School',
  ])),
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

const renderAccount = async (role, extra = {}) => {
  useAuth.mockReturnValue({
    user: {
      uid: 'admin-1',
      role,
      name: 'Ada',
      email: 'ada@example.com',
      ...extra,
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

test('shows the signed-in account school next to the role', async () => {
  const tester = await renderAccount('tester', { school: 'Helene College of Nursing' });
  expect(tester.root.findByProps({ 'aria-label': 'Account school' }).children)
    .toEqual(['Helene College of Nursing']);
  expect(tester.root.findByProps({ 'aria-label': 'School' }).children)
    .toEqual(['Helene College of Nursing']);

  const admin = await renderAccount('admin', {
    schools: ['Helene College of Nursing', 'Example Second School'],
  });
  expect(admin.root.findByProps({ 'aria-label': 'Account school' }).children)
    .toEqual(['Helene College of Nursing, Example Second School']);
  expect(admin.root.findAllByProps({ 'aria-label': 'Schools' })[0].findAllByType('li')
    .map((item) => item.children.join('')))
    .toEqual(['Helene College of Nursing', 'Example Second School']);

  const superAdmin = await renderAccount('superadmin');
  expect(superAdmin.root.findByProps({ 'aria-label': 'Account school' }).children).toEqual(['All']);
  expect(listMasterSchools).toHaveBeenCalled();
  expect(superAdmin.root.findByProps({ 'aria-label': 'Master schools' }).findAllByType('li')
    .map((item) => item.children.join('')))
    .toEqual(['Helene College of Nursing', 'Example Second School']);

  const missing = await renderAccount('tester', { school: '' });
  expect(missing.root.findByProps({ 'aria-label': 'Account school' }).children).toEqual(['—']);
  expect(missing.root.findByProps({ 'aria-label': 'School' }).children).toEqual(['—']);
});

test('account schools replaces saved school profiles and does not write them', async () => {
  const onManageSchools = jest.fn();
  useAuth.mockReturnValue({
    user: {
      uid: 'super-1',
      role: 'superadmin',
      name: 'Sam',
      email: 'sam@example.com',
    },
    updateUser: jest.fn(),
  });
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <EditAccount onBack={() => {}} onManageSchools={onManageSchools} />
    );
  });
  await act(async () => {
    await Promise.resolve();
  });

  const text = treeText(renderer);
  expect(text).not.toContain('Saved School / Client Profiles');
  expect(text).not.toContain('Add School Profile');
  expect(text).not.toContain('Enter school name');
  expect(text).not.toContain('Set as new default school');
  const manage = renderer.root.findAllByType('button')
    .find((button) => button.children.includes('Manage schools'));
  await act(async () => {
    manage.props.onClick();
  });
  expect(onManageSchools).toHaveBeenCalled();
});
