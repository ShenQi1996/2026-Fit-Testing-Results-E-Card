import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { generateFitTestCard } from './fitTestCardTemplate';

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

const buildFitTestPdf = async (formData) => {
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
  doc.save(`fit-test-result-${safeName}.pdf`);
};

export const previewFitTestPdf = async (formData) => {
  const { doc } = await buildFitTestPdf(formData);
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
};
