import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../../context/AuthContext';
import { saveFitTest } from '../../services/firebaseDb';
import { sendFitTestCard } from '../../services/emailService';
import {
  deleteFitTestDraft,
  listFitTestDrafts,
  saveFitTestDraft,
} from '../../services/fitTestDraftsDb';
import FitTestForm from './FitTestForm';
import FitTestDraftsPanel, { DraftBanner } from './FitTestDraftsPanel';
import SignatureSection from './SignatureSection';

jest.mock('./SignaturePad', () => {
  const ReactActual = require('react');
  return ReactActual.forwardRef(() => null);
});

jest.mock('./../common/CardPreview', () => () => null);

jest.mock('../../utils/pdfUtils', () => ({
  downloadFitTestPdf: jest.fn(),
  previewFitTestPdf: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/masterSchools', () => ({
  listMasterSchoolRecords: jest.fn(async () => []),
  getMasterSchoolRecord: jest.fn(async (name) => ({
    name,
    programAdministratorName: '',
    programAdministratorContact: '',
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

jest.mock('../../services/fitTestDraftsDb', () => {
  const actual = jest.requireActual('../../services/fitTestDraftsDb');
  return {
    ...actual,
    saveFitTestDraft: jest.fn(async () => 'draft-new'),
    listFitTestDrafts: jest.fn(async () => []),
    deleteFitTestDraft: jest.fn(async () => {}),
  };
});

const HELENE = 'Helene College of Nursing';
const TESTER = {
  uid: 'tester-1',
  role: 'tester',
  name: 'Tess',
  email: 'tess@example.com',
  school: HELENE,
};

const completeDraft = {
  id: 'draft-1',
  ownerUid: 'tester-1',
  updatedAt: { toMillis: () => Date.UTC(2026, 10, 14, 15, 0) },
  recipientEmail: 'ada@example.com',
  clientName: 'Ada Client',
  printedName: 'Ada Client',
  testLocation: 'Harlem',
  fitTestType: 'N95',
  fitTestMethod: 'Qualitative',
  respiratorMfg: '3M',
  testingAgent: 'Bitrex',
  maskSize: 'Regular',
  model: '1860',
  style: 'Duckbill',
  result: 'Pass',
  schoolsList: HELENE,
  studentClearanceConfirmed: true,
  consentToFitTest: true,
  privacyPolicyAcknowledged: true,
  recordDeliveryConfirmed: true,
  testerMedicalRestrictionsReceived: true,
  testerMedicalRestrictionsNote: 'No strenuous exercise',
};

const flush = async () => {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const renderForm = async (user = TESTER) => {
  useAuth.mockReturnValue({ user });
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<FitTestForm />);
  });
  await flush();
  return renderer;
};

const textOf = (renderer) => JSON.stringify(renderer.toJSON());

const nodeText = (node) => (typeof node === 'string'
  ? node
  : (node.children || []).map(nodeText).join(''));

const buttonWithText = (renderer, text) => renderer.root.findAllByType('button')
  .find((node) => nodeText(node).includes(text));

const click = async (node) => {
  await act(async () => {
    await node.props.onClick();
  });
  await flush();
};

const openDraft = async (renderer, name = 'Ada Client') => {
  await click(renderer.root.findByProps({ 'aria-label': `Open draft for ${name}` }));
};

const signBoth = async (renderer) => {
  const section = renderer.root.findByType(SignatureSection);
  await act(async () => {
    section.props.onSignatureStroke(true);
    section.props.onTesterSignatureStroke(true);
  });
};

const submit = async (renderer) => {
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  await flush();
};

beforeEach(() => {
  jest.clearAllMocks();
  listFitTestDrafts.mockResolvedValue([]);
  saveFitTestDraft.mockResolvedValue('draft-new');
  deleteFitTestDraft.mockResolvedValue();
  saveFitTest.mockResolvedValue('fit-1');
  sendFitTestCard.mockResolvedValue();
});

test('a Save as draft button sits next to the send button', async () => {
  const renderer = await renderForm();
  const save = buttonWithText(renderer, 'Save as draft');
  expect(save).toBeDefined();
  expect(save.props.type).toBe('button');
  expect(save.props.disabled).toBe(false);
  expect(buttonWithText(renderer, 'Send Fit Test Results E-Card')).toBeDefined();
  expect(listFitTestDrafts).toHaveBeenCalledWith('tester-1');
});

test('saving a draft does not validate, send, or create a record, lookup or card', async () => {
  listFitTestDrafts
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 'draft-new', ownerUid: 'tester-1', clientName: '' }]);
  const renderer = await renderForm();
  await click(buttonWithText(renderer, 'Save as draft'));

  expect(saveFitTestDraft).toHaveBeenCalledTimes(1);
  const [uid, form, draftId] = saveFitTestDraft.mock.calls[0];
  expect(uid).toBe('tester-1');
  expect(form.clientName).toBe('');
  expect(draftId).toBeNull();
  expect(saveFitTest).not.toHaveBeenCalled();
  expect(sendFitTestCard).not.toHaveBeenCalled();
  expect(textOf(renderer)).not.toContain('Please fix the following errors');
  expect(textOf(renderer)).toContain('Draft saved. It has not been sent.');
  expect(textOf(renderer)).toContain('Draft, not sent');
  expect(buttonWithText(renderer, 'Update draft')).toBeDefined();
  expect(textOf(renderer)).toContain('Untitled draft');
});

test('saving an open draft again updates the same draft', async () => {
  listFitTestDrafts.mockResolvedValue([completeDraft]);
  const renderer = await renderForm();
  await openDraft(renderer);
  saveFitTestDraft.mockResolvedValueOnce('draft-1');
  await click(buttonWithText(renderer, 'Update draft'));
  expect(saveFitTestDraft.mock.calls[0][2]).toBe('draft-1');
  expect(saveFitTestDraft.mock.calls[0][1].clientName).toBe('Ada Client');
});

test('the drafts section lists only drafts, each with a DRAFT badge, and is hidden when empty', async () => {
  const empty = await renderForm();
  expect(empty.root.findAllByType(FitTestDraftsPanel)[0].findAllByType('section')).toHaveLength(0);

  listFitTestDrafts.mockResolvedValue([
    completeDraft,
    { id: 'draft-2', ownerUid: 'tester-1', clientName: '', recipientEmail: '' },
  ]);
  const renderer = await renderForm();
  const panel = renderer.root.findByProps({ 'aria-label': 'Your drafts' });
  const items = panel.findAllByType('li');
  expect(items).toHaveLength(2);
  items.forEach((item) => {
    expect(item.findAllByProps({ className: 'draft-badge' })).toHaveLength(1);
    expect(nodeText(item.findByProps({ className: 'draft-badge' }))).toBe('DRAFT');
  });
  expect(textOf(renderer)).toContain('Ada Client');
  expect(textOf(renderer)).toContain('Untitled draft');
  expect(textOf(renderer)).toContain('No recipient yet');
  // The form itself is not in draft state until one is opened.
  expect(renderer.root.findByType('form').props['data-draft']).toBe('false');
  expect(renderer.root.findAllByType(DraftBanner)).toHaveLength(0);
});

test('one tap reopens a draft into the form, with a banner and draft styling', async () => {
  listFitTestDrafts.mockResolvedValue([completeDraft]);
  const renderer = await renderForm();
  await openDraft(renderer);

  expect(renderer.root.findByProps({ id: 'clientName' }).props.value).toBe('Ada Client');
  expect(renderer.root.findByProps({ id: 'recipientEmail' }).props.value).toBe('ada@example.com');
  const form = renderer.root.findByType('form');
  expect(form.props.className).toContain('fit-test-form--draft');
  expect(form.props['data-draft']).toBe('true');
  const banner = renderer.root.findByType(DraftBanner);
  expect(nodeText(banner.findByProps({ role: 'status' }))).toContain('Draft, not sent');
  expect(textOf(renderer)).toContain('Preview only. Draft, not sent.');
  expect(textOf(renderer)).toContain('Both signatures must be signed again');
  expect(textOf(renderer)).toContain('Open now');
});

test('Start a new form leaves the draft untouched and clears the draft state', async () => {
  listFitTestDrafts.mockResolvedValue([completeDraft]);
  const renderer = await renderForm();
  await openDraft(renderer);
  await click(buttonWithText(renderer, 'Start a new form'));
  expect(renderer.root.findByType('form').props['data-draft']).toBe('false');
  expect(renderer.root.findByProps({ id: 'clientName' }).props.value).toBe('');
  expect(deleteFitTestDraft).not.toHaveBeenCalled();
});

test('sending from a draft creates the record as usual, then deletes the draft', async () => {
  listFitTestDrafts.mockResolvedValue([completeDraft]);
  const renderer = await renderForm();
  await openDraft(renderer);
  await signBoth(renderer);
  await submit(renderer);

  expect(saveFitTest).toHaveBeenCalledTimes(1);
  const [uid, record] = saveFitTest.mock.calls[0];
  expect(uid).toBe('tester-1');
  expect(record).toMatchObject({
    clientName: 'Ada Client',
    style: 'Duckbill',
    fitTestMethod: 'Qualitative',
    testerMedicalRestrictionsReceived: true,
    testerMedicalRestrictionsNote: 'No strenuous exercise',
  });
  expect(record).not.toHaveProperty('fitFactor');
  expect(record).not.toHaveProperty('ownerUid');
  expect(deleteFitTestDraft).toHaveBeenCalledWith('draft-1');
  expect(saveFitTest.mock.invocationCallOrder[0]).toBeLessThan(deleteFitTestDraft.mock.invocationCallOrder[0]);
  expect(sendFitTestCard).toHaveBeenCalledTimes(1);
  expect(textOf(renderer)).toContain('sent successfully');
  expect(renderer.root.findByType('form').props['data-draft']).toBe('false');
  expect(renderer.root.findAllByProps({ 'aria-label': 'Open draft for Ada Client' })).toHaveLength(0);
});

test('a failed send keeps the draft', async () => {
  saveFitTest.mockRejectedValueOnce(new Error('offline'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  listFitTestDrafts.mockResolvedValue([completeDraft]);
  const renderer = await renderForm();
  await openDraft(renderer);
  await signBoth(renderer);
  await submit(renderer);

  expect(saveFitTest).toHaveBeenCalledTimes(1);
  expect(deleteFitTestDraft).not.toHaveBeenCalled();
  expect(sendFitTestCard).not.toHaveBeenCalled();
  expect(renderer.root.findByType('form').props['data-draft']).toBe('true');
  expect(textOf(renderer)).toContain('was not sent');
  console.error.mockRestore();
});

test('if the record saves but the email fails, the draft is still removed so it cannot be sent twice', async () => {
  sendFitTestCard.mockRejectedValueOnce(new Error('email down'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  listFitTestDrafts.mockResolvedValue([completeDraft]);
  const renderer = await renderForm();
  await openDraft(renderer);
  await signBoth(renderer);
  await submit(renderer);

  expect(saveFitTest).toHaveBeenCalledTimes(1);
  expect(deleteFitTestDraft).toHaveBeenCalledWith('draft-1');
  expect(textOf(renderer)).toContain('You can resend it from Results');
  console.error.mockRestore();
});

test('a draft missing the style cannot be sent: style is checked on send, not on save', async () => {
  listFitTestDrafts.mockResolvedValue([{ ...completeDraft, style: '' }]);
  const renderer = await renderForm();
  await openDraft(renderer);
  await signBoth(renderer);
  expect(buttonWithText(renderer, 'Send Fit Test Results E-Card').props.disabled).toBe(true);
  await submit(renderer);
  expect(saveFitTest).not.toHaveBeenCalled();
  expect(deleteFitTestDraft).not.toHaveBeenCalled();
  expect(textOf(renderer)).toContain('Please select the respirator style.');
});

test('deleting a draft asks once more, then hard deletes it', async () => {
  listFitTestDrafts.mockResolvedValue([completeDraft]);
  const renderer = await renderForm();
  await click(renderer.root.findByProps({ 'aria-label': 'Delete draft for Ada Client' }));
  expect(deleteFitTestDraft).not.toHaveBeenCalled();
  await click(buttonWithText(renderer, 'Delete draft'));
  expect(deleteFitTestDraft).toHaveBeenCalledWith('draft-1');
  expect(renderer.root.findAllByProps({ 'aria-label': 'Open draft for Ada Client' })).toHaveLength(0);
});

test('faculty see no draft controls', async () => {
  const renderer = await renderForm({ ...TESTER, uid: 'fac-1', role: 'faculty' });
  expect(buttonWithText(renderer, 'Save as draft')).toBeUndefined();
  expect(listFitTestDrafts).not.toHaveBeenCalled();
});
