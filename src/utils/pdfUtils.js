import { generateFitTestCard } from './fitTestCardTemplate';

// jspdf and html2canvas are large, so they load only when a PDF is previewed
// or downloaded (or prefetched by a page that offers PDF buttons). The promise
// is shared so a prefetch and a click never download the chunks twice, and it
// resets on failure so a flaky network can retry.
let pdfLibrariesPromise = null;

const loadPdfLibraries = () => {
  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = Promise.all([
      import(/* webpackChunkName: "pdf-jspdf" */ 'jspdf'),
      import(/* webpackChunkName: "pdf-html2canvas" */ 'html2canvas'),
    ])
      .then(([jspdfModule, html2canvasModule]) => ({
        jsPDF: jspdfModule.jsPDF,
        html2canvas: html2canvasModule.default || html2canvasModule,
      }))
      .catch((err) => {
        pdfLibrariesPromise = null;
        throw err;
      });
  }
  return pdfLibrariesPromise;
};

// Warm the PDF chunks without blocking anything (hover/focus on a PDF button,
// or idle time after a page that offers PDFs mounts).
export const prefetchPdfLibraries = () => {
  loadPdfLibraries().catch(() => {});
};

// Prefetch once the browser is idle after a page with PDF buttons mounts, so
// the first Preview/Download usually finds the chunks already cached.
// Returns a cancel function for useEffect cleanup.
export const schedulePdfPrefetch = (delayMs = 2000) => {
  if (typeof window === 'undefined') return () => {};
  let idleId = null;
  const timerId = setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => prefetchPdfLibraries(), { timeout: 5000 });
    } else {
      prefetchPdfLibraries();
    }
  }, delayMs);
  return () => {
    clearTimeout(timerId);
    if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
  };
};

// Safari (and iOS Safari) only allow window.open while the click's user
// gesture is still active. Preview needs async work first (chunk download,
// html2canvas, sometimes a Firestore read), so the tab is opened synchronously
// on click and pointed at the PDF once it is ready.
export const PREVIEW_BLOCKED_MESSAGE =
  'Your browser blocked the preview window, so the PDF was downloaded instead. Allow pop-ups for this site to preview PDFs.';

// Keep the blob URL alive long enough for Safari's PDF viewer to load it.
export const BLOB_URL_REVOKE_DELAY_MS = 60 * 1000;

const PREPARING_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>Preparing PDF…</title>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
  '<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
  'display:flex;align-items:center;justify-content:center;height:100vh;color:#333;background:#f5f5f5">' +
  '<p>Preparing PDF…</p></body></html>';

const openPreviewWindow = () => {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return null;
  let win = null;
  try {
    // No 'noopener' here: with it, window.open returns null and the tab
    // could not be navigated to the PDF afterwards. The opener is cleared below.
    win = window.open('', '_blank');
  } catch (_err) {
    win = null;
  }
  if (!win) return null;
  try {
    win.opener = null;
  } catch (_err) {
    // ignore
  }
  try {
    win.document.open();
    win.document.write(PREPARING_HTML);
    win.document.close();
  } catch (_err) {
    // The placeholder text is cosmetic; the PDF still loads.
  }
  return win;
};

const closeWindow = (win) => {
  try {
    if (win && !win.closed) win.close();
  } catch (_err) {
    // ignore
  }
};

const scheduleRevoke = (blobUrl) => {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  setTimeout(() => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch (_err) {
      // ignore
    }
  }, BLOB_URL_REVOKE_DELAY_MS);
};

const PDF_SHARE_TITLE = 'Fit Testing Results E-card';

const createCardRenderElement = (formData) => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '900px';
  wrapper.style.background = '#e8e8e8';
  wrapper.style.padding = '20px';
  wrapper.style.zIndex = '-1';
  wrapper.innerHTML = generateFitTestCard(formData);
  document.body.appendChild(wrapper);
  return wrapper;
};

const applyPdfMetadata = (doc, formData) => {
  const clientName = (formData.clientName || '').trim();
  doc.setProperties({
    title: clientName ? `${PDF_SHARE_TITLE} - ${clientName}` : PDF_SHARE_TITLE,
    subject: PDF_SHARE_TITLE,
    author: 'Secure Fit LLC',
    creator: 'Secure Fit LLC',
    keywords: '',
  });
};

const getPdfFilename = (safeName) => `fit-test-result-${safeName}.pdf`;

const shareOrDownloadPdf = async (doc, filename) => {
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof File !== 'undefined' &&
    (!navigator.canShare || navigator.canShare({ files: [file] }));

  if (canShareFiles) {
    try {
      // Only the file is shared. Do not pass `url` or `text` — phones would
      // attach the internal form-app page title and link.
      await navigator.share({
        files: [file],
        title: PDF_SHARE_TITLE,
      });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }
    }
  }

  doc.save(filename);
};

const buildFitTestPdf = async (formData) => {
  const { jsPDF, html2canvas } = await loadPdfLibraries();
  const renderElement = createCardRenderElement(formData);

  try {
    const canvas = await html2canvas(renderElement, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#e8e8e8',
      logging: false,
    });

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 24;

    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;
    const widthScale = availableWidth / canvas.width;
    const heightScale = availableHeight / canvas.height;
    const scale = Math.min(widthScale, heightScale);

    const imgWidth = canvas.width * scale;
    const imgHeight = canvas.height * scale;
    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;

    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    applyPdfMetadata(doc, formData);

    const safeName = (formData.clientName || 'client')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .toLowerCase();

    return { doc, safeName };
  } finally {
    document.body.removeChild(renderElement);
  }
};

export const downloadFitTestPdf = async (formData) => {
  const { doc, safeName } = await buildFitTestPdf(formData);
  await shareOrDownloadPdf(doc, getPdfFilename(safeName));
};

// `formDataOrLoader` may be the form data, a promise of it, or a function that
// returns either. Callers must call this directly from the click handler,
// before any await of their own, so the preview tab opens inside the gesture.
// Resolves to { mode: 'preview' } or, when the pop-up was blocked,
// { mode: 'download', message } after falling back to doc.save.
export const previewFitTestPdf = async (formDataOrLoader) => {
  // Must stay before the first await.
  const win = openPreviewWindow();

  let doc;
  let safeName;
  try {
    const formData = await (typeof formDataOrLoader === 'function'
      ? formDataOrLoader()
      : formDataOrLoader);
    ({ doc, safeName } = await buildFitTestPdf(formData));
  } catch (err) {
    closeWindow(win);
    throw err;
  }

  if (!win || win.closed) {
    doc.save(getPdfFilename(safeName));
    return { mode: 'download', message: PREVIEW_BLOCKED_MESSAGE };
  }

  const blobUrl = doc.output('bloburl');
  try {
    win.location.href = blobUrl;
  } catch (_err) {
    closeWindow(win);
    doc.save(getPdfFilename(safeName));
    scheduleRevoke(blobUrl);
    return { mode: 'download', message: PREVIEW_BLOCKED_MESSAGE };
  }
  scheduleRevoke(blobUrl);
  return { mode: 'preview' };
};
