import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import { saveFitTest } from '../../services/firebaseDb';
import { getMasterSchoolRecord, listMasterSchoolRecords } from '../../services/masterSchools';
import FitTestForm from './FitTestForm';
import { NO_ASSIGNED_SCHOOL_MESSAGE, SELECT_SCHOOL_MESSAGE } from '../../utils/ecardSchools';

jest.mock('./SignaturePad', () => {
  const ReactActual = require('react');
  return ReactActual.forwardRef(() => null);
});

jest.mock('../../utils/pdfUtils', () => ({
  downloadFitTestPdf: jest.fn(),
  previewFitTestPdf: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/masterSchools', () => ({
  listMasterSchoolRecords: jest.fn(() => Promise.resolve([
    {
      name: 'Helene College of Nursing',
      programAdministratorName: 'School Admin',
      programAdministratorContact: 'school@example.com',
    },
    {
      name: 'Example Second School',
      programAdministratorName: '',
      programAdministratorContact: '',
    },
  ])),
  getMasterSchoolRecord: jest.fn(async (name) => ({
    name,
    programAdministratorName: name === 'Helene College of Nursing' ? 'School Admin' : '',
    programAdministratorContact: name === 'Helene College of Nursing' ? 'school@example.com' : '',
  })),
}));

jest.mock('../../services/firebaseDb', () => ({
  saveFitTest: jest.fn(),
  getUserSolutionProfiles: jest.fn(() => Promise.resolve([])),
  saveUserSolutionProfile: jest.fn(),
}));

jest.mock('../../services/emailService', () => ({
  sendFitTestCard: jest.fn(),
}));

jest.mock('../../services/emailSendLog', () => ({
  getLastStaffSendAt: jest.fn(),
  recordStaffSend: jest.fn(),
}));

const HELENE = 'Helene College of Nursing';
const SECOND = 'Example Second School';

const renderForm = async (user) => {
  useAuth.mockReturnValue({ user });
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<FitTestForm />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
  return renderer;
};

const optionValues = (select) => select.findAllByType('option').map((option) => option.props.value);

const submit = async (renderer) => {
  await act(async () => {
    renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  listMasterSchoolRecords.mockResolvedValue([
    {
      name: HELENE,
      programAdministratorName: 'School Admin',
      programAdministratorContact: 'school@example.com',
    },
    {
      name: SECOND,
      programAdministratorName: '',
      programAdministratorContact: '',
    },
  ]);
});

test('a tester sees only their school, pre-selected and read-only', async () => {
  const renderer = await renderForm({
    uid: 'tester-1',
    role: 'tester',
    name: 'Tess',
    email: 'tess@example.com',
    school: HELENE,
  });

  const school = renderer.root.findByProps({ 'aria-label': 'School / client' });
  expect(school.children).toEqual([HELENE]);
  expect(renderer.root.findAllByType('select').some((node) => node.props.id === 'schoolsList')).toBe(false);
  expect(renderer.root.findAllByType('input').some((node) => node.props.id === 'schoolsListOther')).toBe(false);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Other / Add new school');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Program administrator name');
  expect(renderer.root.findAllByProps({ id: 'programAdministratorName' })).toHaveLength(0);
  expect(renderer.root.findAllByProps({ id: 'programAdministratorContact' })).toHaveLength(0);
  expect(listMasterSchoolRecords).not.toHaveBeenCalled();
  expect(getMasterSchoolRecord).toHaveBeenCalledWith(HELENE);
});

test('an admin picks from their schools array and one school is pre-selected', async () => {
  const several = await renderForm({
    uid: 'admin-1',
    role: 'admin',
    name: 'Ada',
    email: 'ada@example.com',
    schools: [SECOND, HELENE],
  });
  const select = several.root.findByProps({ id: 'schoolsList' });
  expect(optionValues(select)).toEqual(['', SECOND, HELENE]);
  expect(select.props.value).toBe('');
  await submit(several);
  expect(saveFitTest).not.toHaveBeenCalled();
  expect(JSON.stringify(several.toJSON())).toContain(SELECT_SCHOOL_MESSAGE);

  const one = await renderForm({
    uid: 'admin-2',
    role: 'admin',
    name: 'Helen',
    email: 'helen@example.com',
    schools: [HELENE],
  });
  expect(one.root.findByProps({ 'aria-label': 'School / client' }).children).toEqual([HELENE]);
  expect(one.root.findAllByProps({ id: 'schoolsList' })[0].type).not.toBe('select');
});

test('a super admin picks from the master school list', async () => {
  const renderer = await renderForm({
    uid: 'super-1',
    role: 'superadmin',
    name: 'Sam',
    email: 'sam@example.com',
  });

  expect(listMasterSchoolRecords).toHaveBeenCalled();
  const select = renderer.root.findByProps({ id: 'schoolsList' });
  expect(optionValues(select)).toEqual(['', HELENE, SECOND]);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Other / Add new school');
  expect(renderer.root.findAllByType('input').some((node) => node.props.id === 'schoolsListOther')).toBe(false);
});

test('a user with no school cannot submit an e-card', async () => {
  const renderer = await renderForm({
    uid: 'tester-2',
    role: 'tester',
    name: 'No School',
    email: 'none@example.com',
    school: '',
  });

  expect(JSON.stringify(renderer.toJSON())).toContain(NO_ASSIGNED_SCHOOL_MESSAGE);
  const button = renderer.root.findAllByType('button')
    .find((node) => node.children.includes('Send Fit Test Results E-Card'));
  expect(button.props.disabled).toBe(true);
  await submit(renderer);
  expect(saveFitTest).not.toHaveBeenCalled();
});
