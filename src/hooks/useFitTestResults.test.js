import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../context/AuthContext';
import {
  deleteFitTest,
  ensureFitTestVerification,
  getFacultyFitTests,
  getUserFitTests,
  updateFitTest,
} from '../services/firebaseDb';
import { previewFitTestPdf } from '../utils/pdfUtils';
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
  style: 'Cup (molded)',
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

test('a legacy edit with no style stays on the form', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, style: '' });
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  expect(updateFitTest).not.toHaveBeenCalled();
  expect(apiRef.current.error).toBe('');
  expect(apiRef.current.editError).toBe('Please select the respirator style.');
  expect(apiRef.current.editing).toBe('ft-1');
});

test('an edit does not ask for a method and strips any fit factor', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, fitTestMethod: undefined, fitFactor: 100 });
  });
  expect(apiRef.current.editData.fitTestMethod).toBeUndefined();
  expect(apiRef.current.editData.fitFactor).toBeUndefined();

  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  expect(updateFitTest).toHaveBeenCalledWith(
    'ft-1',
    expect.objectContaining({
      fitTestMethod: 'Qualitative',
      fitFactor: { kind: 'deleteField' },
    }),
    'admin-1',
  );
});

test('a legacy Locked to Qualitative value saves as Qualitative', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, fitTestMethod: 'Locked to Qualitative' });
  });
  expect(apiRef.current.editData.fitTestMethod).toBeUndefined();

  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  const payload = updateFitTest.mock.calls[0][1];
  expect(payload.fitTestMethod).toBe('Qualitative');
  expect(payload.fitFactor).toEqual({ kind: 'deleteField' });
});

test('editing a legacy quantitative record keeps its method and fit factor', async () => {
  const quantitative = {
    ...record,
    fitTestMethod: 'Quantitative',
    fitFactor: 180,
  };
  getUserFitTests.mockResolvedValue([quantitative]);
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick(quantitative);
  });
  await act(async () => {
    apiRef.current.handleEditChange('clientName', 'Ada King');
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  const payload = updateFitTest.mock.calls[0][1];
  expect(payload.fitTestMethod).toBe('Quantitative');
  expect(payload.fitFactor).toBe(180);
  expect(payload.clientName).toBe('Ada King');
});

test('editing a legacy quantitative record with no fit factor does not add one', async () => {
  const quantitative = {
    ...record,
    fitTestMethod: 'Quantitative',
  };
  getUserFitTests.mockResolvedValue([quantitative]);
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick(quantitative);
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  const payload = updateFitTest.mock.calls[0][1];
  expect(payload.fitTestMethod).toBe('Quantitative');
  expect(payload.fitFactor).toBeUndefined();
});

test('editing a legacy record with no testing agent does not add Bitrex', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, testingAgent: undefined });
  });
  expect(apiRef.current.editData.testingAgent).toBe('');

  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });

  const payload = updateFitTest.mock.calls[0][1];
  expect(payload.testingAgent).toBeUndefined();
  expect(Object.prototype.hasOwnProperty.call(payload, 'testingAgent')).toBe(false);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, testingAgent: '' });
  });
  await act(async () => {
    apiRef.current.handleEditChange('testingAgent', 'Saccharin');
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });
  expect(updateFitTest.mock.calls[1][1].testingAgent).toBe('Saccharin');
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

const confirmDelete = async (apiRef, reason = 'Duplicate entry') => {
  await act(async () => {
    apiRef.current.handleDeleteClick('ft-1', 'Ada Lovelace');
  });
  await act(async () => {
    apiRef.current.handleDeleteReasonChange(reason);
  });
  await act(async () => {
    await apiRef.current.handleDeleteConfirm();
  });
};

test('a soft delete that Firestore rejects shows the real error code', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const failure = new Error('Failed to delete fit test record (permission-denied). Please try again.');
  failure.code = 'permission-denied';
  deleteFitTest.mockRejectedValue(failure);
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await confirmDelete(apiRef);

  expect(deleteFitTest).toHaveBeenCalledWith('ft-1', 'admin-1', 'Duplicate entry');
  expect(apiRef.current.error).toBe('Failed to delete fit test record (permission-denied). Please try again.');
  expect(apiRef.current.fitTests.map((test) => test.id)).toEqual(['ft-1']);
  expect(consoleError).toHaveBeenCalledWith('Error deleting fit test:', failure);
  consoleError.mockRestore();
});

test('a soft delete outside the admin schools shows that reason, not the generic message', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const failure = new Error('You can only remove fit tests for your schools.');
  failure.code = 'PERMISSION_DENIED';
  deleteFitTest.mockRejectedValue(failure);
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await confirmDelete(apiRef);

  expect(apiRef.current.error).toBe('You can only remove fit tests for your schools.');
  consoleError.mockRestore();
});

test('a successful soft delete removes the record from the list', async () => {
  deleteFitTest.mockResolvedValue(undefined);
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await confirmDelete(apiRef);

  expect(apiRef.current.error).toBe('');
  expect(apiRef.current.fitTests).toEqual([]);
});

test('a legacy edit with an earlier style value opens blank and must pick a new style', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, style: 'Filtering facepiece' });
  });
  expect(apiRef.current.editData.style).toBe('');
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });
  expect(updateFitTest).not.toHaveBeenCalled();
  expect(apiRef.current.editError).toBe('Please select the respirator style.');

  await act(async () => {
    apiRef.current.handleEditChange('style', 'Duckbill');
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });
  expect(updateFitTest).toHaveBeenCalledTimes(1);
  expect(updateFitTest.mock.calls[0][1].style).toBe('Duckbill');
});

test('a legacy edit with no style saves once a style is chosen', async () => {
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, style: undefined });
  });
  expect(apiRef.current.editData.style).toBe('');
  await act(async () => {
    apiRef.current.handleEditChange('style', 'Flat-fold');
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });
  expect(updateFitTest).toHaveBeenCalledTimes(1);
  expect(updateFitTest.mock.calls[0][1].style).toBe('Flat-fold');
});

test('a Qualitative edit removes fitFactor from the list instead of keeping the deleteField sentinel', async () => {
  getUserFitTests.mockResolvedValue([{ ...record, fitFactor: 100 }]);
  ensureFitTestVerification.mockImplementation(async (test) => test);
  const apiRef = { current: null };
  await renderProbe(apiRef);

  await act(async () => {
    apiRef.current.handleEditClick({ ...record, fitFactor: 100 });
  });
  await act(async () => {
    await apiRef.current.handleEditSave('ft-1');
  });
  expect(updateFitTest).toHaveBeenCalledWith(
    'ft-1',
    expect.objectContaining({ fitFactor: { kind: 'deleteField' } }),
    'admin-1',
  );

  const listed = apiRef.current.fitTests.find((test) => test.id === 'ft-1');
  expect(listed).not.toHaveProperty('fitFactor');

  await act(async () => {
    await apiRef.current.handlePreviewResultPdf(listed);
  });
  const passed = ensureFitTestVerification.mock.calls[0][0];
  expect(passed).not.toHaveProperty('fitFactor');
  expect(previewFitTestPdf).toHaveBeenCalled();
});
