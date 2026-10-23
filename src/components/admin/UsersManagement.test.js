import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import {
  getAllUsers,
  getFitTestCountsByUser,
  getPendingUsers,
  updateManagedUser,
  updateUserApprovalStatus,
} from '../../services/firebaseDb';
import { createManagedAuthUser } from '../../services/firebaseAuth';
import {
  addMasterSchool,
  listMasterSchools,
  removeMasterSchool,
  renameMasterSchool,
} from '../../services/masterSchools';
import UsersManagement from './UsersManagement';
import { accessDateInputValue } from '../../utils/roles';

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

jest.mock('../../services/masterSchools', () => ({
  listMasterSchools: jest.fn(() => Promise.resolve(['Helene College of Nursing'])),
  addMasterSchool: jest.fn(),
  renameMasterSchool: jest.fn(),
  removeMasterSchool: jest.fn(),
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

const PENDING_USERS = [
  {
    id: 'admin-pending',
    name: 'Pat',
    email: 'pat@example.com',
    role: 'admin',
    status: 'pending',
    schools: [HELENE],
    requestedAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 'tester-1',
    name: 'Tess',
    email: 'tess@example.com',
    role: 'tester',
    status: 'pending',
    school: HELENE,
    requestedAt: '2026-10-02T12:00:00.000Z',
  },
  {
    id: 'tester-2',
    name: 'Other School',
    email: 'other-school@example.com',
    role: 'tester',
    status: 'pending',
    school: SECOND,
    requestedAt: '2026-10-03T12:00:00.000Z',
  },
];

const heleneAdmin = {
  uid: 'admin-1',
  role: 'admin',
  email: 'admin@example.com',
  schools: [HELENE],
};

const optionValues = (select) => select.findAllByType('option').map((option) => option.props.value);

const schoolGroup = (root) => root.findByProps({ 'aria-label': 'Schools' });

const checkboxNames = (group) => group.findAllByType('label').map((label) => (
  label.findByType('span').children.join('')
));

const checkboxFor = (group, name) => group.findAllByType('label').find((label) => (
  label.findByType('span').children.join('') === name
)).findByType('input');

const statusPill = (card) => card.findByProps({ 'aria-label': 'Account status' });

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

const renderPage = async (user, pendingUsers = USERS.filter((item) => item.status === 'pending'), users = USERS) => {
  useAuth.mockReturnValue({ user });
  getAllUsers.mockResolvedValue(users);
  getFitTestCountsByUser.mockResolvedValue({});
  getPendingUsers.mockResolvedValue(pendingUsers);
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<UsersManagement />);
  });
  await act(async () => {
    await Promise.resolve();
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

const openCreateForm = async (renderer) => {
  await act(async () => {
    buttonWithText(renderer, 'Add User').props.onClick();
  });
  return renderer.root.findByProps({ className: 'users-create-form' });
};

const createUserButton = (form) => form.findAllByType('button').find((button) => (
  button.children.includes('Create User')
));

const submitCreateForm = async (form) => {
  await act(async () => {
    form.props.onSubmit({ preventDefault() {} });
  });
  await act(async () => {
    await Promise.resolve();
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
    .toEqual(['All']);

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

test('pending approval tab lists users an admin can approve and hides other admins', async () => {
  const admin = await renderPage(heleneAdmin, PENDING_USERS);
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

test('a scoped admin only sees pending testers in their schools', async () => {
  const renderer = await renderPage(scopedAdmin, PENDING_USERS);
  await openPendingTab(renderer);

  const listed = pendingCards(renderer).map(cardText).join('\n');
  expect(listed).toContain('tess@example.com');
  expect(listed).not.toContain('other-school@example.com');
  expect(listed).not.toContain('pat@example.com');
});

test('approve and reject on the pending tab call updateUserApprovalStatus', async () => {
  updateUserApprovalStatus.mockResolvedValue();
  const renderer = await renderPage(heleneAdmin, PENDING_USERS);
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

const accessDateInputs = (node) => node.findAll(
  (child) => child.type === 'input'
    && (child.props['aria-label'] === 'Access start' || child.props['aria-label'] === 'Access end'),
);

const superAdminUser = {
  uid: 'super-1',
  role: 'superadmin',
  email: 'sam@example.com',
};

test('access date fields appear only when a super admin edits an admin', async () => {
  const superRenderer = await renderPage(superAdminUser);
  expect(accessDateInputs(cardFor(superRenderer, 'admin-2'))).toHaveLength(2);
  expect(accessDateInputs(cardFor(superRenderer, 'admin-helene'))).toHaveLength(2);
  expect(accessDateInputs(cardFor(superRenderer, 'tester-1'))).toHaveLength(0);
  expect(accessDateInputs(cardFor(superRenderer, 'super-1'))).toHaveLength(0);

  const adminRenderer = await renderPage(scopedAdmin);
  expect(accessDateInputs(adminRenderer.root)).toHaveLength(0);
});

test('an access end date before the start date is rejected', async () => {
  const renderer = await renderPage(superAdminUser);
  const card = cardFor(renderer, 'admin-2');
  const start = card.findByProps({ 'aria-label': 'Access start' });
  const end = card.findByProps({ 'aria-label': 'Access end' });
  await act(async () => {
    start.props.onChange({ target: { value: '2026-10-10' } });
    end.props.onChange({ target: { value: '2026-10-01' } });
  });
  const save = cardFor(renderer, 'admin-2').findAllByType('button')
    .find((button) => button.children.includes('Save'));
  await act(async () => {
    save.props.onClick();
  });

  expect(renderer.root.findByProps({ className: 'users-error' }).children).toEqual([
    'Access end date cannot be before the start date.',
  ]);
  expect(updateManagedUser).not.toHaveBeenCalled();
});

test('a super admin can clear an admin access window', async () => {
  const admin = USERS.find((item) => item.id === 'admin-2');
  const previous = { startDate: admin.startDate, endDate: admin.endDate };
  admin.startDate = '2026-06-01T12:00:00.000Z';
  admin.endDate = '2026-12-31T12:00:00.000Z';
  updateManagedUser.mockImplementation(async (_actorId, id, draft) => ({
    id,
    role: 'admin',
    ...draft,
    startDate: null,
    endDate: null,
  }));
  try {
    const renderer = await renderPage(superAdminUser);
    const card = cardFor(renderer, 'admin-2');
    expect(card.findByProps({ 'aria-label': 'Access start' }).props.value)
      .toBe(accessDateInputValue(admin.startDate));
    expect(card.findByProps({ 'aria-label': 'Access end' }).props.value)
      .toBe(accessDateInputValue(admin.endDate));
    await act(async () => {
      card.findByProps({ 'aria-label': 'Access start' }).props.onChange({ target: { value: '' } });
      card.findByProps({ 'aria-label': 'Access end' }).props.onChange({ target: { value: '' } });
    });
    const save = cardFor(renderer, 'admin-2').findAllByType('button')
      .find((button) => button.children.includes('Save'));
    await act(async () => {
      save.props.onClick();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(updateManagedUser).toHaveBeenCalledWith(
      'super-1',
      'admin-2',
      expect.objectContaining({ startDate: '', endDate: '' }),
    );
  } finally {
    admin.startDate = previous.startDate;
    admin.endDate = previous.endDate;
  }
});

test('a scoped admin with one school tags a new tester automatically', async () => {
  createManagedAuthUser.mockResolvedValue({
    id: 'new-1',
    email: 'new@example.com',
    role: 'tester',
    status: 'pending',
    school: HELENE,
  });
  const renderer = await renderPage(scopedAdmin);
  const form = await openCreateForm(renderer);

  expect(form.findAll(
    (node) => node.type === 'select' && node.props['aria-label'] === 'School',
  )).toHaveLength(0);
  expect(form.findByProps({ 'aria-label': 'School' }).children).toEqual([HELENE]);
  expect(createUserButton(form).props.disabled).toBe(false);

  await submitCreateForm(form);

  expect(createManagedAuthUser).toHaveBeenCalledWith('admin-helene', expect.objectContaining({
    role: 'tester',
    school: HELENE,
  }));
});

test('a scoped admin with several schools must pick one before saving', async () => {
  createManagedAuthUser.mockResolvedValue({
    id: 'new-2',
    email: 'new@example.com',
    role: 'tester',
    status: 'pending',
    school: SECOND,
  });
  const renderer = await renderPage({
    uid: 'admin-multi',
    role: 'admin',
    email: 'multi@example.com',
    schools: [HELENE, SECOND],
  });
  const form = await openCreateForm(renderer);
  const schoolSelect = form.findByProps({ 'aria-label': 'School' });

  expect(schoolSelect.type).toBe('select');
  expect(optionValues(schoolSelect)).toEqual(['', HELENE, SECOND]);
  expect(createUserButton(form).props.disabled).toBe(true);

  await act(async () => {
    schoolSelect.props.onChange({ target: { value: SECOND } });
  });
  const nextForm = renderer.root.findByProps({ className: 'users-create-form' });
  expect(createUserButton(nextForm).props.disabled).toBe(false);
  await submitCreateForm(nextForm);

  expect(createManagedAuthUser).toHaveBeenCalledWith('admin-multi', expect.objectContaining({
    role: 'tester',
    school: SECOND,
  }));
});

test('a scoped admin with no schools cannot create a tester', async () => {
  const renderer = await renderPage({
    uid: 'admin-none',
    role: 'admin',
    email: 'none@example.com',
    schools: [],
  });
  const form = await openCreateForm(renderer);

  expect(form.findAllByType('p').map((node) => node.children.join('')).join(' ')).toContain(
    'You have no schools assigned, so you cannot add a tester.'
  );
  expect(createUserButton(form).props.disabled).toBe(true);
  await submitCreateForm(form);
  expect(createManagedAuthUser).not.toHaveBeenCalled();
});

test('a super admin can leave a new tester school unset', async () => {
  createManagedAuthUser.mockResolvedValue({
    id: 'new-3',
    email: 'new@example.com',
    role: 'tester',
    status: 'pending',
  });
  const renderer = await renderPage({
    uid: 'super-1',
    role: 'superadmin',
    email: 'sam@example.com',
  });
  const form = await openCreateForm(renderer);
  const schoolSelect = form.findByProps({ 'aria-label': 'School' });

  expect(schoolSelect.type).toBe('select');
  expect(optionValues(schoolSelect)).toEqual(['', HELENE]);
  expect(createUserButton(form).props.disabled).toBe(false);

  await submitCreateForm(form);

  const payload = createManagedAuthUser.mock.calls[0][1];
  expect(createManagedAuthUser).toHaveBeenCalledWith('super-1', expect.any(Object));
  expect(payload.role).toBe('tester');
  expect(payload).not.toHaveProperty('school');
});

test('the schools section is only shown to a super admin', async () => {
  addMasterSchool.mockResolvedValue([HELENE, 'North Campus']);
  renameMasterSchool.mockResolvedValue(['North Campus']);
  removeMasterSchool.mockResolvedValue([]);
  global.window = { confirm: jest.fn(() => true) };

  const adminRenderer = await renderPage(scopedAdmin);
  expect(adminRenderer.root.findAllByProps({ 'aria-label': 'Master schools' })).toHaveLength(0);
  expect(adminRenderer.root.findAllByType('button').some((button) => button.children.includes('+ Add School')))
    .toBe(false);

  const renderer = await renderPage(superAdminUser);
  const section = renderer.root.findByProps({ 'aria-label': 'Master schools' });
  const sectionLabels = section.findAllByType('button').map((button) => button.props['aria-label']);
  expect(sectionLabels).toEqual(expect.arrayContaining([`Edit ${HELENE}`, `Remove ${HELENE}`]));
  expect(section.findAllByType('button').some((button) => button.children.includes('+ Add School'))).toBe(true);
  expect(section.findAllByProps({ className: 'solution-profile-item' })).toHaveLength(1);

  await act(async () => {
    section.findAllByType('button')
      .find((button) => button.props['aria-label'] === `Remove ${HELENE}`)
      .props.onClick();
  });
  expect(removeMasterSchool).toHaveBeenCalledWith('super-1', HELENE);

  const nameInput = renderer.root.findByProps({ 'aria-label': 'New school name' });
  expect(nameInput.props.className).toBe('users-search');
  await act(async () => {
    nameInput.props.onChange({ target: { value: 'North Campus' } });
  });
  await act(async () => {
    renderer.root.findAllByType('button').find((button) => button.children.includes('+ Add School')).props.onClick();
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(addMasterSchool).toHaveBeenCalledWith('super-1', 'North Campus');

  await act(async () => {
    renderer.root.findByProps({ 'aria-label': 'Master schools' })
      .findAllByType('button')
      .find((button) => button.props['aria-label'] === `Edit ${HELENE}`)
      .props.onClick();
  });
  await act(async () => {
    renderer.root.findByProps({ 'aria-label': 'Edit school name' }).props.onChange({
      target: { value: 'North Campus' },
    });
  });
  await act(async () => {
    renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === 'Save school name').props.onClick();
  });
  expect(renameMasterSchool).toHaveBeenCalledWith('super-1', HELENE, 'North Campus');
});

test('super admin cards show All and a save does not change stored schools', async () => {
  updateManagedUser.mockImplementation(async (_actorId, id, draft) => ({
    id,
    role: 'superadmin',
    ...draft,
  }));
  const stored = {
    id: 'super-stored',
    name: 'Other Super',
    email: 'other-super@example.com',
    role: 'superadmin',
    status: 'approved',
    schools: [HELENE],
  };
  const sam = {
    id: 'super-sam',
    name: 'Sam',
    email: 'qisam1989@gmail.com',
    role: 'superadmin',
    status: 'approved',
  };
  const renderer = await renderPage({
    uid: 'super-sam',
    role: 'superadmin',
    email: 'qisam1989@gmail.com',
  }, [], [stored, sam]);

  expect(cardFor(renderer, 'super-stored').findByProps({ 'aria-label': 'Schools' }).children)
    .toEqual(['All']);
  expect(cardFor(renderer, 'super-sam').findByProps({ 'aria-label': 'Schools' }).children)
    .toEqual(['All']);
  expect(cardFor(renderer, 'super-stored').findAll(
    (node) => node.type === 'select' && node.props['aria-label'] === 'Schools',
  )).toHaveLength(0);
  expect(cardFor(renderer, 'super-sam').findAll(
    (node) => node.type === 'select' && node.props['aria-label'] === 'Schools',
  )).toHaveLength(0);

  const name = cardFor(renderer, 'super-stored').findAllByType('input')
    .find((input) => input.props.type === 'text');
  await act(async () => {
    name.props.onChange({ target: { value: 'Renamed Super' } });
  });
  const save = cardFor(renderer, 'super-stored').findAllByType('button')
    .find((button) => button.children.includes('Save'));
  await act(async () => {
    save.props.onClick();
  });
  await act(async () => {
    await Promise.resolve();
  });

  const payload = updateManagedUser.mock.calls[0][2];
  expect(payload.name).toBe('Renamed Super');
  expect(payload).not.toHaveProperty('schools');
  expect(payload).not.toHaveProperty('school');
});

test('a super admin checks schools when creating an admin', async () => {
  listMasterSchools.mockResolvedValue([HELENE, SECOND]);
  createManagedAuthUser.mockResolvedValue({
    id: 'new-admin',
    email: 'new-admin@example.com',
    role: 'admin',
    status: 'approved',
    schools: [HELENE, SECOND],
  });
  const renderer = await renderPage(superAdminUser);
  const form = await openCreateForm(renderer);
  await act(async () => {
    form.findByProps({ 'aria-label': 'Role' }).props.onChange({ target: { value: 'admin' } });
  });
  const nextForm = renderer.root.findByProps({ className: 'users-create-form' });
  const schools = schoolGroup(nextForm);
  expect(schools.type).toBe('fieldset');
  expect(checkboxNames(schools)).toEqual([HELENE, SECOND]);
  expect(checkboxFor(schools, HELENE).props.checked).toBe(false);
  expect(checkboxFor(schools, SECOND).props.checked).toBe(false);
  expect(nextForm.findAll(
    (node) => node.type === 'select' && node.props['aria-label'] === 'School',
  )).toHaveLength(0);
  expect(createUserButton(nextForm).props.disabled).toBe(true);

  await act(async () => {
    checkboxFor(schoolGroup(renderer.root.findByProps({ className: 'users-create-form' })), HELENE)
      .props.onChange({ target: { checked: true } });
  });
  await act(async () => {
    checkboxFor(schoolGroup(renderer.root.findByProps({ className: 'users-create-form' })), SECOND)
      .props.onChange({ target: { checked: true } });
  });
  const readyForm = renderer.root.findByProps({ className: 'users-create-form' });
  expect(checkboxFor(schoolGroup(readyForm), HELENE).props.checked).toBe(true);
  expect(checkboxFor(schoolGroup(readyForm), SECOND).props.checked).toBe(true);
  expect(createUserButton(readyForm).props.disabled).toBe(false);
  await submitCreateForm(readyForm);

  const payload = createManagedAuthUser.mock.calls[0][1];
  expect(payload.schools).toEqual([HELENE, SECOND]);
  expect(payload).not.toHaveProperty('school');
  expect(payload.role).toBe('admin');
});

test('a super admin edits another admin with school checkboxes', async () => {
  listMasterSchools.mockResolvedValue([HELENE]);
  updateManagedUser.mockImplementation(async (_actorId, id, draft) => ({
    id,
    role: 'admin',
    status: 'approved',
    name: 'Ada',
    email: 'ada@example.com',
    ...draft,
  }));
  const renderer = await renderPage(superAdminUser);
  const adminCard = cardFor(renderer, 'admin-2');
  const schools = schoolGroup(adminCard);
  expect(schools.type).toBe('fieldset');
  expect(schools.findAllByType('select')).toHaveLength(0);
  expect(checkboxNames(schools)).toEqual([HELENE, SECOND]);
  expect(checkboxFor(schools, HELENE).props.checked).toBe(true);
  expect(checkboxFor(schools, SECOND).props.checked).toBe(true);
  expect(schoolGroup(cardFor(renderer, 'super-1')).type).not.toBe('fieldset');

  await act(async () => {
    checkboxFor(schoolGroup(cardFor(renderer, 'admin-2')), SECOND)
      .props.onChange({ target: { checked: false } });
  });
  const save = cardFor(renderer, 'admin-2').findAllByType('button')
    .find((button) => button.children.includes('Save'));
  await act(async () => {
    save.props.onClick();
  });
  await act(async () => {
    await Promise.resolve();
  });

  expect(updateManagedUser.mock.calls[0][2].schools).toEqual([HELENE]);
});

test('the status pill shows Expired, Approved, or Pending without writing', async () => {
  const users = [
    {
      id: 'expired-admin',
      name: 'Expired Admin',
      email: 'expired@example.com',
      role: 'admin',
      status: 'approved',
      schools: [HELENE],
      endDate: '2020-01-15T23:59:59',
    },
    {
      id: 'open-admin',
      name: 'Open Admin',
      email: 'open@example.com',
      role: 'admin',
      status: 'approved',
      schools: [HELENE],
      startDate: '2020-01-01T00:00:00',
      endDate: '2099-12-31T23:59:59',
    },
    {
      id: 'undated-admin',
      name: 'Undated Admin',
      email: 'undated@example.com',
      role: 'admin',
      status: 'approved',
      schools: [HELENE],
    },
    {
      id: 'pending-admin',
      name: 'Pending Admin',
      email: 'pending-admin@example.com',
      role: 'admin',
      status: 'pending',
      schools: [HELENE],
      endDate: '2020-01-15T23:59:59',
    },
  ];
  const renderer = await renderPage(superAdminUser, [], users);

  const expired = statusPill(cardFor(renderer, 'expired-admin'));
  expect(expired.children).toEqual(['Expired']);
  expect(expired.props.className).toContain('status-expired');

  const inWindow = statusPill(cardFor(renderer, 'open-admin'));
  expect(inWindow.children).toEqual(['Approved']);
  expect(inWindow.props.className).toContain('status-approved');
  expect(inWindow.props.className).not.toContain('status-expired');

  const noDates = statusPill(cardFor(renderer, 'undated-admin'));
  expect(noDates.children).toEqual(['Approved']);
  expect(noDates.props.className).toContain('status-approved');

  const pending = statusPill(cardFor(renderer, 'pending-admin'));
  expect(pending.children).toEqual(['Pending']);
  expect(pending.props.className).toContain('status-pending');
  expect(pending.props.className).not.toContain('status-expired');

  expect(updateManagedUser).not.toHaveBeenCalled();
});

test('the Admin role badge uses opaque colors with readable contrast', () => {
  const css = readFileSync(join(__dirname, 'UsersManagement.css'), 'utf8');
  const block = css.match(/\.user-badge\.role-admin\s*\{([^}]+)\}/);
  expect(block).not.toBeNull();
  const background = block[1].match(/background:\s*(#[0-9a-fA-F]{6})/);
  const color = block[1].match(/color:\s*(#[0-9a-fA-F]{6})/);
  expect(background).not.toBeNull();
  expect(color).not.toBeNull();
  expect(block[1]).not.toMatch(/var\(--navy\)/);
  expect(block[1]).not.toMatch(/rgba\(11,\s*45,\s*74/);

  const channel = (hex) => {
    const value = parseInt(hex.slice(1), 16);
    return [16, 8, 0].map((shift) => {
      const unit = ((value >> shift) & 255) / 255;
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    });
  };
  const luminance = (hex) => {
    const [red, green, blue] = channel(hex);
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  };
  const [lighter, darker] = [luminance(background[1]), luminance(color[1])]
    .sort((left, right) => right - left);
  expect((lighter + 0.05) / (darker + 0.05)).toBeGreaterThanOrEqual(4.5);
});
