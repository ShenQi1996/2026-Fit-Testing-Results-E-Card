import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import {
  getAllUsers,
  getFitTestCountsByUser,
  getPendingUsers,
  updateManagedUser,
  updateUserApprovalStatus,
} from '../../services/firebaseDb';
import UsersManagement from './UsersManagement';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/firebaseDb', () => ({
  USER_ROLES: ['tester', 'admin', 'superadmin'],
  USER_STATUSES: ['pending', 'approved', 'rejected'],
  getAllUsers: jest.fn(),
  getFitTestCountsByUser: jest.fn(),
  getPendingUsers: jest.fn(() => Promise.resolve([])),
  updateManagedUser: jest.fn(),
  updateUserApprovalStatus: jest.fn(() => Promise.resolve()),
  deleteManagedUser: jest.fn(),
}));

jest.mock('../../services/firebaseAuth', () => ({
  createManagedAuthUser: jest.fn(),
}));

const USERS = [
  {
    id: 'super-1',
    name: 'Sam',
    email: 'sam@example.com',
    role: 'superadmin',
    status: 'approved',
  },
  {
    id: 'admin-2',
    name: 'Ada',
    email: 'ada@example.com',
    role: 'admin',
    status: 'approved',
  },
  {
    id: 'tester-1',
    name: 'Tess',
    email: 'tess@example.com',
    role: 'tester',
    status: 'pending',
  },
];

const PENDING_USERS = [
  {
    id: 'admin-pending',
    name: 'Pat',
    email: 'pat@example.com',
    role: 'admin',
    status: 'pending',
    requestedAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 'tester-1',
    name: 'Tess',
    email: 'tess@example.com',
    role: 'tester',
    status: 'pending',
    requestedAt: '2026-10-02T12:00:00.000Z',
  },
];

const optionValues = (select) => select.findAllByType('option').map((option) => option.props.value);

const selectsByLabel = (renderer, label) => renderer.root.findAll(
  (node) => node.type === 'select' && node.props['aria-label'] === label,
);

const cardFor = (renderer, uid) => renderer.root.findAllByProps({ className: 'user-card' }).find((card) => {
  const idLine = card.findAllByProps({ className: 'user-id' })[0];
  return idLine && idLine.children.join('') === `UID: ${uid}`;
});

const buttonWithText = (renderer, text) => renderer.root.findAllByType('button').find((button) => (
  button.children.includes(text)
));

const pendingCards = (renderer) => renderer.root.findAllByProps({
  className: 'user-card pending-approval-card',
});

const cardText = (card) => card.findAllByType('p').map((node) => node.children.join('')).join(' ');

const renderPage = async (user, pendingUsers = USERS.filter((item) => item.status === 'pending')) => {
  useAuth.mockReturnValue({ user });
  getAllUsers.mockResolvedValue(USERS);
  getFitTestCountsByUser.mockResolvedValue({});
  getPendingUsers.mockResolvedValue(pendingUsers);
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<UsersManagement />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return renderer;
};

const openPendingTab = async (renderer) => {
  await act(async () => {
    buttonWithText(renderer, 'Pending approval').props.onClick();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('role choices are tester or admin, and an existing superadmin stays read-only', async () => {
  const renderer = await renderPage({
    uid: 'super-1',
    role: 'superadmin',
    email: 'sam@example.com',
  });

  expect(renderer.root.findAllByType('option').map((option) => option.props.value))
    .not.toContain('superadmin');

  const filterOptions = optionValues(selectsByLabel(renderer, 'Role filter')[0]);
  expect(filterOptions).toEqual(['all', 'tester', 'admin']);

  const superCard = cardFor(renderer, 'super-1');
  expect(superCard.findAllByType('select').map((select) => select.props['aria-label']))
    .not.toContain('Role');
  expect(superCard.findByProps({ className: 'user-role-readonly' }).children).toEqual(['superadmin']);

  const editableRoles = [cardFor(renderer, 'admin-2'), cardFor(renderer, 'tester-1')]
    .map((card) => optionValues(card.findAll(
      (node) => node.type === 'select' && node.props['aria-label'] === 'Role',
    )[0]));
  expect(editableRoles).toEqual([
    ['tester', 'admin'],
    ['tester', 'admin'],
  ]);

  const addUser = renderer.root.findAllByType('button').find((button) => button.children.includes('Add User'));
  await act(async () => {
    addUser.props.onClick();
  });
  const createForm = renderer.root.findByProps({ className: 'users-create-form' });
  expect(optionValues(createForm.findByProps({ 'aria-label': 'Role' }))).toEqual(['tester', 'admin']);
  expect(renderer.root.findAllByType('option').map((option) => option.props.value))
    .not.toContain('superadmin');
});

test('a regular admin is not offered superadmin', async () => {
  const renderer = await renderPage({
    uid: 'admin-1',
    role: 'admin',
    email: 'admin@example.com',
  });

  expect(renderer.root.findAllByType('option').map((option) => option.props.value))
    .not.toContain('superadmin');
  expect(optionValues(selectsByLabel(renderer, 'Role filter')[0])).toEqual(['all', 'tester', 'admin']);
  expect(cardFor(renderer, 'super-1').findByProps({ className: 'user-role-readonly' }).children)
    .toEqual(['superadmin']);
  expect(optionValues(cardFor(renderer, 'tester-1').findAll(
    (node) => node.type === 'select' && node.props['aria-label'] === 'Role',
  )[0])).toEqual(['tester']);

  const addUser = renderer.root.findAllByType('button').find((button) => button.children.includes('Add User'));
  await act(async () => {
    addUser.props.onClick();
  });
  const createForm = renderer.root.findByProps({ className: 'users-create-form' });
  expect(optionValues(createForm.findByProps({ 'aria-label': 'Role' }))).toEqual(['tester']);
  expect(createForm.findAllByType('option').map((option) => option.props.value))
    .not.toContain('superadmin');
});

test('saving a superadmin keeps the role instead of dropping it', async () => {
  updateManagedUser.mockImplementation(async (_actorId, id, draft) => ({ id, ...draft }));
  const renderer = await renderPage({
    uid: 'super-1',
    role: 'superadmin',
    email: 'sam@example.com',
  });

  const card = cardFor(renderer, 'super-1');
  const nameInput = card.findAllByType('input').find((input) => input.props.type === 'text');
  await act(async () => {
    nameInput.props.onChange({ target: { value: 'Samuel' } });
  });
  const save = card.findAllByType('button').find((button) => button.children.includes('Save'));
  await act(async () => {
    save.props.onClick();
  });
  await act(async () => {
    await Promise.resolve();
  });

  expect(updateManagedUser).toHaveBeenCalledWith(
    'super-1',
    'super-1',
    expect.objectContaining({ name: 'Samuel', role: 'superadmin' }),
  );
  expect(cardFor(renderer, 'super-1').findByProps({ className: 'user-role-readonly' }).children)
    .toEqual(['superadmin']);
});

test('pending approval tab lists users an admin can approve and hides other admins', async () => {
  const admin = await renderPage({
    uid: 'admin-1',
    role: 'admin',
    email: 'admin@example.com',
  }, PENDING_USERS);
  await openPendingTab(admin);

  expect(getPendingUsers).toHaveBeenCalledWith('admin-1');
  expect(pendingCards(admin).map(cardText).join('\n')).toContain('tess@example.com');
  expect(pendingCards(admin).map(cardText).join('\n')).not.toContain('pat@example.com');
  expect(admin.root.findByProps({ className: 'users-filters' }).props.hidden).toBe(true);

  const superAdmin = await renderPage({
    uid: 'super-1',
    role: 'superadmin',
    email: 'sam@example.com',
  }, PENDING_USERS);
  await openPendingTab(superAdmin);

  const listed = pendingCards(superAdmin).map(cardText).join('\n');
  expect(listed).toContain('tess@example.com');
  expect(listed).toContain('pat@example.com');
  expect(listed).toContain('Role: admin');
});

test('approve and reject on the pending tab call updateUserApprovalStatus', async () => {
  updateUserApprovalStatus.mockResolvedValue();
  const renderer = await renderPage({
    uid: 'admin-1',
    role: 'admin',
    email: 'admin@example.com',
  }, PENDING_USERS);
  await openPendingTab(renderer);

  const tessCard = pendingCards(renderer).find((card) => cardText(card).includes('tess@example.com'));
  getPendingUsers.mockResolvedValueOnce(
    PENDING_USERS.filter((item) => item.id !== 'tester-1')
  );
  const approve = tessCard.findAllByType('button').find((button) => button.children.includes('Approve'));
  await act(async () => {
    approve.props.onClick();
  });
  await act(async () => {
    await Promise.resolve();
  });

  expect(updateUserApprovalStatus).toHaveBeenCalledWith('admin-1', 'tester-1', 'approved');
  expect(renderer.root.findByProps({ className: 'users-success' }).children).toEqual([
    'User approved successfully.',
  ]);
  expect(pendingCards(renderer).map(cardText).join('\n')).not.toContain('tess@example.com');

  await act(async () => {
    buttonWithText(renderer, 'All users').props.onClick();
  });
  const rosterStatus = cardFor(renderer, 'tester-1').findAllByType('select').find((select) => (
    select.props.value === 'approved'
  ));
  expect(rosterStatus).toBeTruthy();

  await openPendingTab(renderer);
  const patIsHidden = pendingCards(renderer).every((card) => !cardText(card).includes('pat@example.com'));
  expect(patIsHidden).toBe(true);

  const superAdmin = await renderPage({
    uid: 'super-1',
    role: 'superadmin',
    email: 'sam@example.com',
  }, PENDING_USERS);
  await openPendingTab(superAdmin);
  const patCard = pendingCards(superAdmin).find((card) => cardText(card).includes('pat@example.com'));
  const reject = patCard.findAllByType('button').find((button) => button.children.includes('Reject'));
  await act(async () => {
    reject.props.onClick();
  });
  await act(async () => {
    await Promise.resolve();
  });

  expect(updateUserApprovalStatus).toHaveBeenCalledWith('super-1', 'admin-pending', 'rejected');
  expect(superAdmin.root.findByProps({ className: 'users-success' }).children).toEqual([
    'User rejected successfully.',
  ]);
});
