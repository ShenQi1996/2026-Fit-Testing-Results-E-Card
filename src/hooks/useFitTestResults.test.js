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
  style: 'Filtering facepiece',
  fitTestMethod: 'Qualitative',
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

test('an issue-date edit reloads the results list', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  expect(getUserFitTests).toHaveBeenCalledTimes(1);
  expect(getUserFitTests).toHaveBeenCalledWith('admin-1');

  await act(async () => {
    apiRef.current.handleEditClick(record);
  });
  await act(async () => {
    apiRef.current.handleEditChange('issueDate', '09/01/2026');
  });

  getUserFitTests.mockResolvedValue([{ ...record, issueDate: '09/01/2026' }]);
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });
  await flush();

  expect(updateFitTest).toHaveBeenCalledWith(
    'ft-1',
    expect.objectContaining({ issueDate: '09/01/2026' }),
    'admin-1',
  );
  expect(getUserFitTests).toHaveBeenCalledTimes(2);
  expect(apiRef.current.fitTests.map((test) => test.issueDate)).toEqual(['09/01/2026']);
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

test('a quantitative edit with no fit factor stays on the form', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, fitTestMethod: 'Quantitative', fitFactor: '' });
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  expect(updateFitTest).not.toHaveBeenCalled();
  expect(apiRef.current.error).toBe('');
  expect(apiRef.current.editError).toMatch(/fit factor/i);
  expect(apiRef.current.editing).toBe('ft-1');
});

test('a legacy Locked to Qualitative value edits and saves as Qualitative', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, fitTestMethod: 'Locked to Qualitative' });
  });
  expect(apiRef.current.editData.fitTestMethod).toBe('Qualitative');

  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  expect(updateFitTest).toHaveBeenCalledWith(
    'ft-1',
    expect.objectContaining({ fitTestMethod: 'Qualitative' }),
    'admin-1',
  );
  const payload = updateFitTest.mock.calls[0][1];
  expect(payload.fitTestMethod).not.toBe('Locked to Qualitative');
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
