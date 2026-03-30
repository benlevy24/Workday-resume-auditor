// Parsers for .docx, .doc, and .pdf files
// Returns { text: string, meta: object }

import mammoth from 'mammoth';

// ---------- DOCX / DOC ----------
export async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();

  // Extract raw text (messages contain warnings about skipped content)
  const textResult = await mammoth.extractRawText({ arrayBuffer });

  // Extract HTML to detect structural red flags
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const html = htmlResult.value;

  const allMessages = [...(textResult.messages || []), ...(htmlResult.messages || [])];
  const msgText = allMessages.map(m => (m.message || '').toLowerCase()).join(' ');

  const hasTables    = /<table[\s>]/i.test(html);
  const hasImages    = /<img[\s>]/i.test(html) ||
    allMessages.some(m => /image|drawing|picture/i.test(m.message || ''));
  const hasMultiColumn = detectMultiColumn(textResult.value);

  // Mammoth silently drops text-box / shape content — check its warning messages
  const hasTextBoxes = /txbx|text.?box|shape|drawing|wordprocessingshape/i.test(msgText);

  // Mammoth strips headers/footers — it sometimes warns about this
  const hasHeaderFooter = /header|footer/i.test(msgText);

  return {
    text: htmlToPlainText(html),
    meta: {
      hasTables,
      hasImages,
      hasMultiColumn,
      hasTextBoxes,
      hasHeaderFooter,
      pageCount: null,
    },
  };
}

// ---------- PDF ----------
export async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer();

  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    '../node_modules/pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  let hasImages = false;
  let hasMultiColumn = false;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const xPositions = content.items.map(item => Math.round(item.transform[4]));
    if (detectColumns(xPositions)) hasMultiColumn = true;

    let pageText = '';
    let lastY = null;
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 5) pageText += '\n';
      pageText += item.str + ' ';
      lastY = y;
    }
    fullText += pageText + '\n';

    try {
      const ops = await page.getOperatorList();
      if (ops.fnArray.some(fn =>
        fn === pdfjsLib.OPS.paintImageXObject ||
        fn === pdfjsLib.OPS.paintInlineImageXObject
      )) {
        hasImages = true;
      }
    } catch (_) {
      // ignore
    }
  }

  return {
    text: fullText,
    meta: {
      hasTables: false,
      hasImages,
      hasMultiColumn,
      hasTextBoxes: false,
      hasHeaderFooter: false,
      pageCount: pdf.numPages,
      isPdf: true,
    },
  };
}

// ---------- Helpers ----------

// Convert mammoth HTML to plain text, preserving list item bullets.
// mammoth.extractRawText strips bullet characters entirely, causing list items
// to be indistinguishable from job title lines in the stacked-roles detector.
// Parsing from HTML lets us add a '• ' prefix to every <li> element.
function htmlToPlainText(html) {
  return html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(li|ul|ol)>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectMultiColumn(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 20);
  let suspiciousLines = 0;
  for (const line of lines.slice(0, 30)) {
    if (/\S {4,}\S/.test(line)) suspiciousLines++;
  }
  return suspiciousLines > 3;
}

function detectColumns(xPositions) {
  if (xPositions.length < 10) return false;
  const unique = [...new Set(xPositions)].sort((a, b) => a - b);
  if (unique.length < 4) return false;

  const min = unique[0];
  const max = unique[unique.length - 1];
  const mid = (min + max) / 2;
  const leftCluster  = unique.filter(x => x < mid - 50);
  const rightCluster = unique.filter(x => x > mid + 50);

  return leftCluster.length > 3 && rightCluster.length > 3;
}
