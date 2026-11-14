const mockHtml2canvas = jest.fn();
const mockAddImage = jest.fn();
const mockOutput = jest.fn();
const mockSetProperties = jest.fn();
const mockJsPDF = jest.fn().mockImplementation(() => ({
  internal: { pageSize: { getWidth: () => 612, getHeight: () => 792 } },
  addImage: mockAddImage,
  output: mockOutput,
  setProperties: mockSetProperties,
  save: jest.fn(),
}));

jest.mock('jspdf', () => ({ jsPDF: mockJsPDF }));
jest.mock('html2canvas', () => ({ __esModule: true, default: mockHtml2canvas }));
jest.mock('./fitTestCardTemplate', () => ({ generateFitTestCard: () => '<div>card</div>' }));

const makeFakeDom = () => {
  const appended = [];
  const body = {
    appendChild: jest.fn((el) => appended.push(el)),
    removeChild: jest.fn((el) => appended.splice(appended.indexOf(el), 1)),
  };
  global.document = { createElement: () => ({ style: {}, innerHTML: '' }), body };
  global.window = { open: jest.fn() };
  return { appended, body };
};

afterEach(() => {
  delete global.document;
  delete global.window;
  jest.clearAllMocks();
});

test('preview loads jspdf and html2canvas on demand and opens the PDF', async () => {
  const { appended } = makeFakeDom();
  mockHtml2canvas.mockResolvedValue({ width: 900, height: 600, toDataURL: () => 'data:image/png;base64,x' });
  mockOutput.mockReturnValue('blob:pdf');
  const { previewFitTestPdf } = require('./pdfUtils');

  await previewFitTestPdf({ clientName: 'Ada Lovelace' });

  expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
  expect(mockJsPDF).toHaveBeenCalledWith({ unit: 'pt', format: 'letter' });
  expect(mockAddImage).toHaveBeenCalledTimes(1);
  expect(global.window.open).toHaveBeenCalledWith('blob:pdf', '_blank', 'noopener,noreferrer');
  expect(appended).toHaveLength(0);
});

test('a render failure still removes the hidden card and rejects', async () => {
  const { appended, body } = makeFakeDom();
  mockHtml2canvas.mockRejectedValue(new Error('canvas failed'));
  const { downloadFitTestPdf } = require('./pdfUtils');

  await expect(downloadFitTestPdf({ clientName: 'Ada' })).rejects.toThrow('canvas failed');
  expect(body.removeChild).toHaveBeenCalledTimes(1);
  expect(appended).toHaveLength(0);
  expect(mockJsPDF).not.toHaveBeenCalled();
});
