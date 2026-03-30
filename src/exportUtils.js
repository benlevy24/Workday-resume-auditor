// Generates a clean, ATS-safe .docx from plain text
// Uses the 'docx' package to produce a properly structured Word document.

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  AlignmentType,
  convertInchesToTwip,
} from 'docx';

import { STANDARD_SECTION_KEYWORDS } from './scoringEngine';

function classifyLine(line, index) {
  const trimmed = line.trim();
  if (!trimmed) return 'blank';

  // First non-empty line is treated as the candidate name
  if (index === 0) return 'name';

  const lower = trimmed.toLowerCase();

  // Standard section heading match
  if (STANDARD_SECTION_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw + ' '))) {
    return 'section';
  }

  // All-caps short line (common heading style in resumes)
  const noNumbers = trimmed.replace(/[\d\s\/\-.,|]/g, '');
  if (
    noNumbers.length > 2 &&
    noNumbers === noNumbers.toUpperCase() &&
    trimmed.length < 50
  ) {
    return 'section';
  }

  // Bullet line — starts with common bullet chars or hyphen
  if (/^[-•·–—]/.test(trimmed)) return 'bullet';

  return 'body';
}

export async function exportToDocx(cleanText, fileName = 'resume') {
  const rawLines = cleanText.split('\n');

  // Find first non-empty line index for name detection
  let firstNonEmpty = 0;
  while (firstNonEmpty < rawLines.length && !rawLines[firstNonEmpty].trim()) {
    firstNonEmpty++;
  }

  const children = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();
    const type = classifyLine(trimmed, i === firstNonEmpty ? 0 : i);

    if (type === 'blank') {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    if (type === 'name') {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: trimmed, bold: true, size: 32 })],
        })
      );
      continue;
    }

    if (type === 'section') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: trimmed.toUpperCase(), bold: true, size: 24 })],
          spacing: { before: convertInchesToTwip(0.15) },
          border: {
            bottom: { style: 'single', size: 6, space: 1, color: '4F4F4F' },
          },
        })
      );
      continue;
    }

    if (type === 'bullet') {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.replace(/^[-•·–—]\s*/, ''), size: 20 })],
          bullet: { level: 0 },
          spacing: { after: 40 },
        })
      );
      continue;
    }

    // body
    children.push(
      new Paragraph({
        children: [new TextRun({ text: trimmed, size: 20 })],
        spacing: { after: 40 },
      })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left:   convertInchesToTwip(0.75),
              right:  convertInchesToTwip(0.75),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const baseName = fileName.replace(/\.(docx?|pdf)$/i, '');
  triggerDownload(blob, `${baseName}-ats-safe.docx`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
