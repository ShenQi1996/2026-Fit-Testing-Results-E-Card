import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import {
  getAllUsers,
  getFitTestCountsByUser,
  updateManagedUser,
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
  updateManagedUser: jest.fn(),
  deleteManagedUser: jest.fn(),
}));

jest.mock('../../services/firebaseAuth', () => ({
  createManagedAuthUser: jest.fn(),
}));

const HELENE = 'Helene College of Nursing';
const SECOND = 'Example Second School';

const USERS = [
  {
    id: 'super-1',
    name: 'Sam',
    email: 'sam@example.com',
    role: 'superadmin',
    status: 'approved',
    schools: [HELENE, SECOND],
  },
  {
    id: 'admin-2',
    name: 'Ada',
    email: 'ada@example.com',
    role: 'admin',
    status: 'approved',
    schools: [HELENE, SECOND],
  },
  {
    id: 'admin-helene',
    name: 'Helen Admin',
    email: 'helen-admin@example.com',
    role: 'admin',
    status: 'approved',
    schools: [HELENE],
  },
  {
    id: 'tester-1',
    name: 'Tess',
    email: 'tess@example.com',
    role: 'tester',
    status: 'pending',
    school: HELENE,
  },
  {
    id: 'tester-2',
    name: 'Other School',
    email: 'other-school@example.com',
    role: 'tester',
    status: 'approved',
    school: SECOND,
  },
];

const scopedAdmin = {
  uid: 'admin-helene',
  role: 'admin',
  email: 'helen-admin@example.com',
  schools: [HELENE],
};

const optionValues = (select) => select.findAllByType('option').map((option) => option.props.value);

const selectsByLabel = (renderer, label) => renderer.root.findAll(
  (node) => node.type === 'select' && node.props['aria-label'] === label,
);

const cardFor = (renderer, uid) => renderer.root.findAllByProps({ className: 'user-card' }).find((card) => {
  const idLine = card.findAllByProps({ className: 'user-id' })[0];
  return idLine && idLine.children.join('') === `UID: ${uid}`;
});

const renderPage = async (user) => {
  useAuth.mockReturnValue({ user });
  getAllUsers.mockResolvedValue(USERS);
  getFitTestCountsByUser.mockResolvedValue({});
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<UsersManagement />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return renderer;
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
  const renderer = await renderPage(scopedAdmin);

  expect(renderer.root.findAllByType('option').map((option) => option.props.value))
    .not.toContain('superadmin');
  expect(optionValues(selectsByLabel(renderer, 'Role filter')[0])).toEqual(['all', 'tester', 'admin']);
  expect(cardFor(renderer, 'super-1')).toBeUndefined();
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

test('a scoped admin sees only users in their schools and cannot edit school tags', async () => {
  const renderer = await renderPage(scopedAdmin);
  const visibleIds = renderer.root.findAllByProps({ className: 'user-id' })
    .map((node) => node.children.join('').replace('UID: ', ''));

  expect(visibleIds).toEqual(['admin-helene', 'tester-1']);
  expect(cardFor(renderer, 'tester-1').findByProps({ 'aria-label': 'School' }).children)
    .toEqual([HELENE]);
  expect(cardFor(renderer, 'tester-1').findAll(
    (node) => node.type === 'input' && node.props['aria-label'] === 'School',
  )).toHaveLength(0);

  const editableRoles = renderer.root.findAll(
    (node) => node.type === 'select' && node.props['aria-label'] === 'Role' && !node.props.disabled,
  );
  expect(editableRoles.map(optionValues)).toEqual([['tester']]);
});

test('a super admin sees every user and can set school tags', async () => {
  updateManagedUser.mockImplementation(async (_actorId, id, draft) => ({
    id,
    ...draft,
    schools: draft.schools || [],
  }));
  const renderer = await renderPage({
    uid: 'super-1',
    role: 'superadmin',
    email: 'sam@example.com',
    schools: [HELENE, SECOND],
  });
  const visibleIds = renderer.root.findAllByProps({ className: 'user-id' })
    .map((node) => node.children.join('').replace('UID: ', ''));

  expect(visibleIds).toEqual(['super-1', 'admin-2', 'admin-helene', 'tester-1', 'tester-2']);
  expect(cardFor(renderer, 'super-1').findByProps({ 'aria-label': 'Schools' }).children)
    .toEqual([`${HELENE}, ${SECOND}`]);

  const testerCard = cardFor(renderer, 'tester-1');
  const schoolInput = testerCard.findByProps({ 'aria-label': 'School' });
  await act(async () => {
    schoolInput.props.onChange({ target: { value: SECOND } });
  });
  const save = cardFor(renderer, 'tester-1').findAllByType('button')
    .find((button) => button.children.includes('Save'));
  await act(async () => {
    save.props.onClick();
  });
  await act(async () => {
    await Promise.resolve();
  });

  expect(updateManagedUser).toHaveBeenCalledWith(
    'super-1',
    'tester-1',
    expect.objectContaining({ school: SECOND, role: 'tester' }),
  );
  expect(updateManagedUser.mock.calls[0][2]).not.toHaveProperty('schools');
});
