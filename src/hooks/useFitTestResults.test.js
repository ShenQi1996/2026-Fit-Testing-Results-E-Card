import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../context/AuthContext';
import { getFacultyFitTests, getUserFitTests, updateFitTest } from '../services/firebaseDb';
import { useFitTestResults } from './useFitTestResults';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../services/firebaseDb', () => ({
  getUserFitTests: jest.fn(),
  getFacultyFitTests: jest.fn(),
  updateFitTest: jest.fn(),
  deleteFitTest: jest.fn(),
  ensureFitTestVerification: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  sendFitTestCard: jest.fn(),
}));

jest.mock('../utils/pdfUtils', () => ({
  downloadFitTestPdf: jest.fn(),
  previewFitTestPdf: jest.fn(),
}));

jest.mock('../utils/csvUtils', () => ({
  downloadFitTestsCsv: jest.fn(),
}));

const record = {
  id: 'ft-1',
  clientName: 'Ada Lovelace',
  issueDate: '10/01/2026',
  testLocation: 'Harlem',
  recipientEmail: 'ada@example.com',
};

const Probe = ({ apiRef }) => {
  const api = useFitTestResults();
  useEffect(() => {
    apiRef.current = api;
  });
  return null;
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

let renderer;

const renderProbe = async (apiRef) => {
  await act(async () => {
    renderer = TestRenderer.create(<Probe apiRef={apiRef} />);
  });
  await flush();
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { uid: 'admin-1', role: 'admin' } });
  getUserFitTests.mockResolvedValue([record]);
  updateFitTest.mockResolvedValue(undefined);
});

afterEach(() => {
  if (renderer) {
    act(() => {
      renderer.unmount();
    });
    renderer = null;
  }
  jest.clearAllTimers();
});

test('an issue-date or result edit is ignored and the list is not reloaded', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  expect(getUserFitTests).toHaveBeenCalledTimes(1);
  expect(getUserFitTests).toHaveBeenCalledWith('admin-1');

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, result: 'Pass' });
  });
  await act(async () => {
    apiRef.current.handleEditChange('issueDate', '09/01/2026');
    apiRef.current.handleEditChange('result', 'Fail');
    apiRef.current.handleEditChange('clientName', 'Ada King');
  });

  expect(apiRef.current.editData.issueDate).toBe('10/01/2026');
  expect(apiRef.current.editData.result).toBe('Pass');
  expect(apiRef.current.editData.clientName).toBe('Ada King');

  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });
  await flush();

  const updates = updateFitTest.mock.calls[0][1];
  expect(updateFitTest).toHaveBeenCalledWith('ft-1', updates, 'admin-1');
  expect(updates.issueDate).toBeUndefined();
  expect(updates.result).toBeUndefined();
  expect(updates.clientName).toBe('Ada King');
  expect(getUserFitTests).toHaveBeenCalledTimes(1);
  expect(apiRef.current.fitTests.map((test) => test.issueDate)).toEqual(['10/01/2026']);
});

test('an edit that keeps the issue date does not reload the results list', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick(record);
  });
  await act(async () => {
    apiRef.current.handleEditChange('clientName', 'Ada King');
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  expect(updateFitTest).toHaveBeenCalledTimes(1);
  expect(getUserFitTests).toHaveBeenCalledTimes(1);
  expect(apiRef.current.fitTests.map((test) => test.clientName)).toEqual(['Ada King']);
});

test('faculty load results by school instead of user id', async () => {
  getFacultyFitTests.mockResolvedValue([record]);
  useAuth.mockReturnValue({
    user: { uid: 'faculty-1', role: 'faculty', school: 'Helene College of Nursing', schools: [] },
  });
  const apiRef = { current: null };
  await renderProbe(apiRef);

  expect(getFacultyFitTests).toHaveBeenCalledWith(expect.objectContaining({
    role: 'faculty',
    school: 'Helene College of Nursing',
  }));
  expect(getUserFitTests).not.toHaveBeenCalled();
  expect(apiRef.current.fitTests.map((test) => test.id)).toEqual(['ft-1']);
});

test('faculty outside the access window do not load results', async () => {
  useAuth.mockReturnValue({
    user: {
      uid: 'faculty-1',
      role: 'faculty',
      school: 'Helene College of Nursing',
      endDate: '2020-01-01T00:00:00.000Z',
    },
  });
  const apiRef = { current: null };
  await renderProbe(apiRef);

  expect(getFacultyFitTests).not.toHaveBeenCalled();
  expect(getUserFitTests).not.toHaveBeenCalled();
  expect(apiRef.current.fitTests).toEqual([]);
  expect(apiRef.current.loading).toBe(false);
});
