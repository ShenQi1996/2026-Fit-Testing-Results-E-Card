const mockHtml2canvas = jest.fn();
const mockAddImage = jest.fn();
const mockOutput = jest.fn();
const mockSetProperties = jest.fn();
const mockSave = jest.fn();
const mockJsPDF = jest.fn().mockImplementation(() => ({
  internal: { pageSize: { getWidth: () => 612, getHeight: () => 792 } },
  addImage: mockAddImage,
  output: mockOutput,
  setProperties: mockSetProperties,
  save: mockSave,
}));

jest.mock('jspdf', () => ({ jsPDF: mockJsPDF }));
jest.mock('html2canvas', () => ({ __esModule: true, default: mockHtml2canvas }));
jest.mock('./fitTestCardTemplate', () => ({ generateFitTestCard: () => '<div>card</div>' }));

const makeFakeWindow = () => ({
  closed: false,
  opener: { fake: true },
  document: { open: jest.fn(), write: jest.fn(), close: jest.fn() },
  location: { href: 'about:blank' },
  close: jest.fn(function close() { this.closed = true; }),
});

const makeFakeDom = ({ popup = makeFakeWindow() } = {}) => {
  const appended = [];
  const body = {
    appendChild: jest.fn((el) => appended.push(el)),
    removeChild: jest.fn((el) => appended.splice(appended.indexOf(el), 1)),
  };
  global.document = { createElement: () => ({ style: {}, innerHTML: '' }), body };
  global.window = { open: jest.fn(() => popup) };
  return { appended, body, popup };
};

const renderOk = () => {
  mockHtml2canvas.mockResolvedValue({ width: 900, height: 600, toDataURL: () => 'data:image/png;base64,x' });
  mockOutput.mockReturnValue('blob:pdf');
};

let revokeSpy;

beforeEach(() => {
  // Fake timers so the delayed blob URL revoke never outlives a test.
  jest.useFakeTimers();
  revokeSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  delete global.document;
  delete global.window;
  revokeSpy.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
  jest.resetModules();
});

test('preview opens the tab synchronously, before the PDF chunk or card data resolve', async () => {
  const { popup } = makeFakeDom();
  renderOk();
  const { previewFitTestPdf } = require('./pdfUtils');

  let resolveData;
  const dataPromise = new Promise((resolve) => { resolveData = resolve; });
  const pending = previewFitTestPdf(() => dataPromise);

  // Still inside the click: the tab exists, nothing async has happened yet.
  expect(global.window.open).toHaveBeenCalledTimes(1);
  expect(global.window.open).toHaveBeenCalledWith('', '_blank');
  expect(popup.document.write).toHaveBeenCalledWith(expect.stringContaining('Preparing PDF…'));
  expect(popup.opener).toBeNull();
  expect(mockJsPDF).not.toHaveBeenCalled();
  expect(mockHtml2canvas).not.toHaveBeenCalled();

  resolveData({ clientName: 'Ada Lovelace' });
  await expect(pending).resolves.toEqual({ mode: 'preview' });

  expect(popup.location.href).toBe('blob:pdf');
  expect(global.window.open).toHaveBeenCalledTimes(1);
  expect(mockSave).not.toHaveBeenCalled();
});

test('preview loads jspdf and html2canvas on demand and renders the card', async () => {
  const { appended, popup } = makeFakeDom();
  renderOk();
  const { previewFitTestPdf } = require('./pdfUtils');

  await previewFitTestPdf({ clientName: 'Ada Lovelace' });

  expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
  expect(mockJsPDF).toHaveBeenCalledWith({ unit: 'pt', format: 'letter' });
  expect(mockAddImage).toHaveBeenCalledTimes(1);
  expect(popup.location.href).toBe('blob:pdf');
  expect(appended).toHaveLength(0);
});

test('the blob URL is revoked later, not immediately', async () => {
  makeFakeDom();
  renderOk();
  const { previewFitTestPdf, BLOB_URL_REVOKE_DELAY_MS } = require('./pdfUtils');

  await previewFitTestPdf({ clientName: 'Ada' });
  expect(revokeSpy).not.toHaveBeenCalled();

  jest.advanceTimersByTime(BLOB_URL_REVOKE_DELAY_MS - 1);
  expect(revokeSpy).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(revokeSpy).toHaveBeenCalledWith('blob:pdf');
});

test('a blocked pop-up falls back to a download and returns a message', async () => {
  makeFakeDom({ popup: null });
  renderOk();
  const { previewFitTestPdf, PREVIEW_BLOCKED_MESSAGE } = require('./pdfUtils');

  const result = await previewFitTestPdf({ clientName: 'Ada Lovelace' });

  expect(result).toEqual({ mode: 'download', message: PREVIEW_BLOCKED_MESSAGE });
  expect(mockSave).toHaveBeenCalledWith('fit-test-result-ada-lovelace.pdf');
  expect(global.window.open).toHaveBeenCalledTimes(1);
});

test('a tab the user closed while it was preparing also falls back to a download', async () => {
  const popup = makeFakeWindow();
  makeFakeDom({ popup });
  renderOk();
  const { previewFitTestPdf } = require('./pdfUtils');

  const pending = previewFitTestPdf({ clientName: 'Ada' });
  popup.closed = true;
  const result = await pending;

  expect(result.mode).toBe('download');
  expect(mockSave).toHaveBeenCalledTimes(1);
});

test('a preview render failure closes the tab, removes the hidden card and rejects', async () => {
  const { appended, body, popup } = makeFakeDom();
  mockHtml2canvas.mockRejectedValue(new Error('canvas failed'));
  const { previewFitTestPdf } = require('./pdfUtils');

  await expect(previewFitTestPdf({ clientName: 'Ada' })).rejects.toThrow('canvas failed');
  expect(popup.close).toHaveBeenCalledTimes(1);
  expect(body.removeChild).toHaveBeenCalledTimes(1);
  expect(appended).toHaveLength(0);
  expect(mockSave).not.toHaveBeenCalled();
});

test('a card data failure closes the tab before any PDF work', async () => {
  const { popup } = makeFakeDom();
  const { previewFitTestPdf } = require('./pdfUtils');

  await expect(
    previewFitTestPdf(() => Promise.reject(new Error('lookup failed'))),
  ).rejects.toThrow('lookup failed');
  expect(popup.close).toHaveBeenCalledTimes(1);
  expect(mockHtml2canvas).not.toHaveBeenCalled();
});

test('a download render failure still removes the hidden card and rejects', async () => {
  const { appended, body } = makeFakeDom();
  mockHtml2canvas.mockRejectedValue(new Error('canvas failed'));
  const { downloadFitTestPdf } = require('./pdfUtils');

  await expect(downloadFitTestPdf({ clientName: 'Ada' })).rejects.toThrow('canvas failed');
  expect(body.removeChild).toHaveBeenCalledTimes(1);
  expect(appended).toHaveLength(0);
  expect(mockJsPDF).not.toHaveBeenCalled();
});

test('download still saves with doc.save when sharing is unavailable', async () => {
  makeFakeDom();
  renderOk();
  mockOutput.mockReturnValue(new Blob(['%PDF']));
  const { downloadFitTestPdf } = require('./pdfUtils');

  await downloadFitTestPdf({ clientName: 'Ada Lovelace' });

  expect(mockSave).toHaveBeenCalledWith('fit-test-result-ada-lovelace.pdf');
  expect(global.window.open).not.toHaveBeenCalled();
});

test('prefetch shares one load with a later click', async () => {
  makeFakeDom();
  renderOk();
  const { prefetchPdfLibraries, previewFitTestPdf } = require('./pdfUtils');
  const jspdf = require('jspdf');

  prefetchPdfLibraries();
  prefetchPdfLibraries();
  await previewFitTestPdf({ clientName: 'Ada' });

  expect(jspdf.jsPDF).toBe(mockJsPDF);
  expect(mockJsPDF).toHaveBeenCalledTimes(1);
});
