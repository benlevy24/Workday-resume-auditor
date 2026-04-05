import { useState, useCallback } from 'react';
import { inject, track } from '@vercel/analytics';

inject();

import { parseDocx, parsePdf } from './fileParser';
import { analyzeResume, generateATSSafeVersion } from './scoringEngine';
import { exportToDocx, exportToTxt } from './exportUtils';
import './App.css';

// ─── Score helpers ────────────────────────────────────────────────────────────
const SCORE_COLOR = (s) => s >= 8 ? '#16a34a' : s >= 5 ? '#d97706' : '#dc2626';
const SCORE_LABEL = (s) => s >= 8 ? 'ATS Ready' : s >= 5 ? 'Needs Work' : 'High Risk';

const SEVERITY_META = {
  critical:       { dot: '🔴', badge: 'CRITICAL',   cls: 'flag-critical'       },
  warning:        { dot: '🟡', badge: 'WARNING',    cls: 'flag-warning'        },
  recommendation: { dot: '🔵', badge: 'TIP',        cls: 'flag-recommendation' },
};

// ─── Highlight helpers ────────────────────────────────────────────────────────

function buildHighlightedLines(text, flagsFound) {
  const active = new Set(flagsFound.map(f => f.id));
  const rawLines = text.split('\n');

  // Precompute which lines are continuation fragments from PDF line-wrap breaks.
  // A fragment is a line that starts with lowercase where the previous non-empty
  // line didn't end with punctuation — chains automatically for multi-line breaks.
  const fragmentedLines = new Set();
  if (active.has('fragmented_pdf_lines')) {
    const DR = /\b(?:\d{1,2}\/)?(?:19|20)\d{2}\s*[-–—]/;
    const isSectionLike = (s) => { const l = s.replace(/[^a-zA-Z]/g, ''); return s.length < 40 && l.length > 2 && l === l.toUpperCase(); };
    let prevContentIdx = null;
    let inChain = false;
    rawLines.forEach((line, i) => {
      const t = line.trim();
      if (!t) return;
      if (prevContentIdx !== null) {
        const prevT = rawLines[prevContentIdx].trim();
        const prevNoEndPunct = !/[.!?:]$/.test(prevT);
        const prevHasDateRange = DR.test(prevT);
        const currIsBullet = /^[*•·\-–]/.test(t);

        // Don't treat pipe-separated list lines as sentence starters
        const prevHasPipes = (prevT.match(/\|/g) || []).length >= 2;
        // Prose lines (containing common sentence words) get a lower length threshold
        const prevIsProse = /\b(the|an?|and|or|but|in|on|at|to|for|of|with|by|from|as|his|her|their|its|this|that|has|have|had|is|was|are|were|been|will|would|could|should)\b/i.test(prevT);
        const threshold = prevIsProse ? 15 : 22;
        // Lowercase continuation only — uppercase starts are too ambiguous to flag reliably
        const lowercaseCont = /^[a-z]/.test(t) && prevNoEndPunct && !prevHasPipes && (prevT.length >= threshold || inChain);

        if (lowercaseCont) {
          fragmentedLines.add(i);
          inChain = true;
        } else {
          inChain = false;
        }
      }
      prevContentIdx = i;
    });
  }

  // Highlight org header lines (date-range lines) that have 2+ title lines below them
  const stackedOrgLines = new Set();
  if (active.has('multiple_roles_one_org')) {
    const DR = /\b(?:\d{1,2}\/)?(?:19|20)\d{2}\s*[-–—]\s*(?:(?:\d{1,2}\/)?(?:19|20)\d{2}|present|current)\b/i;
    const SECT = (t) => { const l = t.replace(/[^a-zA-Z]/g, ''); return t.length < 40 && l.length > 2 && l === l.toUpperCase(); };
    rawLines.forEach((line, i) => {
      if (!DR.test(line)) return;
      const titleLines = [];
      for (let j = i + 1; j < Math.min(i + 20, rawLines.length); j++) {
        const t = rawLines[j].trim();
        if (!t) continue;
        if (DR.test(t) || SECT(t)) break;
        if (t.length >= 5 && t.length <= 120 && !/^[*•·\-–]/.test(t)) titleLines.push(t);
      }
      if (titleLines.length >= 2) stackedOrgLines.add(i);
    });
  }

  // Highlight institution lines and their stacked degree lines using clustering:
  // find an institution line, collect degree lines below it, mark them only if 2+ found.
  // Restricted INST regex avoids generic words like "school" that appear in work bullets.
  const stackedInstLines = new Set();
  if (active.has('multiple_degrees_one_institution')) {
    const INST = /\b(university|college|institute|academy)\b/i;
    const DEGREE = /\b(bachelor'?s?|master'?s?|ph\.?d\.?|doctorate|associate'?s?|mba|mpp|mpa|mph)\b/i;
    let instIdx = null;
    let degreeIdxs = [];
    const flush = () => {
      if (instIdx !== null && degreeIdxs.length >= 2) {
        stackedInstLines.add(instIdx);
        degreeIdxs.forEach(j => stackedInstLines.add(j));
      }
    };
    rawLines.forEach((line, i) => {
      const t = line.trim();
      if (!t || /^[*•·\-–]/.test(t)) return;
      if (INST.test(t)) {
        flush();
        instIdx = i;
        degreeIdxs = [];
      } else if (instIdx !== null && DEGREE.test(t)) {
        degreeIdxs.push(i);
      }
    });
    flush();
  }

  let firstNonEmpty = true;

  return rawLines.map((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) return { trimmed: '', type: 'blank', lineHighlight: null, segments: [] };

    // Line type
    let type = 'body';
    if (firstNonEmpty) {
      type = 'name';
      firstNonEmpty = false;
    } else if (isHeading(trimmed)) {
      type = 'section';
    } else if (/^[-•·]/.test(trimmed)) {
      type = 'bullet';
    }

    // Line-level highlight (whole row tinted)
    let lineHighlight = null;
    if (active.has('decorative_dividers') && /^[=\-─━═~*_]{5,}$/.test(trimmed)) {
      lineHighlight = 'recommendation';
    } else if (active.has('references_upon_request') && /references\s+(are\s+)?(available\s+)?upon\s+request/i.test(trimmed)) {
      lineHighlight = 'recommendation';
    } else if (stackedOrgLines.has(lineIdx) || stackedInstLines.has(lineIdx)) {
      lineHighlight = 'stacked';
    }
    if (!lineHighlight && fragmentedLines.has(lineIdx)) {
      lineHighlight = 'fragmented';
    }
    // Highlight unusual section headers — ALL CAPS lines not matching standard keywords
    if (!lineHighlight && type === 'section' && active.has('unusual_section_headers')) {
      const lower = trimmed.toLowerCase();
      const STANDARD = [
        'experience', 'education', 'skills', 'summary', 'objective',
        'certifications', 'projects', 'volunteer', 'awards', 'publications',
        'references', 'work history', 'employment', 'work experience',
        'technical skills', 'professional experience', 'qualifications',
        'achievements', 'accomplishments', 'languages', 'interests',
        'leadership', 'training', 'professional summary', 'career',
      ];
      if (!STANDARD.some(kw => lower.includes(kw))) lineHighlight = 'warning';
    }

    // Inline segments
    const segments = buildSegments(trimmed, active);

    return { trimmed, type, lineHighlight, segments };
  });
}

function isHeading(text) {
  const lower = text.toLowerCase();
  const KEYWORDS = [
    'experience', 'work experience', 'employment', 'education', 'skills',
    'summary', 'objective', 'certifications', 'projects', 'volunteer',
    'awards', 'publications', 'references', 'technical skills',
    'core competencies', 'professional summary', 'work history',
    'qualifications', 'achievements', 'accomplishments', 'languages',
    'interests', 'activities', 'leadership', 'training',
  ];
  if (KEYWORDS.some(kw => lower === kw || lower.startsWith(kw + ' '))) return true;
  // All-caps short line
  const noNoise = text.replace(/[\d\s/\-.,|:]/g, '');
  return noNoise.length > 2 && noNoise === noNoise.toUpperCase() && text.length < 50;
}

function buildSegments(text, active) {
  const ranges = [];
  const add = (regex, severity) => {
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length, severity });
    }
  };

  if (active.has('special_chars'))
    add(/[★✦◆■▪▸►✓✗✔✘❖⊙◉⚫⬤▶◀]/g, 'warning');
  if (active.has('hyperlinks'))
    add(/https?:\/\/\S+/g, 'recommendation');
  if (active.has('skill_ratings'))
    add(/[●◉○◎★☆✩✪]{2,}|\d\s*\/\s*[3-9]/g, 'warning');
  if (active.has('present_keyword'))
    add(/\bpresent\b/gi, 'recommendation');
  if (active.has('inflated_job_titles'))
    add(/\b(ninja|guru|wizard|rockstar|rock star|jedi|evangelist|unicorn|superhero|hacker)\b/gi, 'recommendation');
  if (active.has('inconsistent_date_formats'))
    add(/(0?[1-9]|1[0-2])\/(19|20)\d{2}|(0?[1-9]|1[0-2])-(19|20)\d{2}/g, 'warning');
  if (active.has('em_en_dash'))
    add(/[–—]/g, 'recommendation');
  if (active.has('pipe_separator'))
    add(/\|/g, 'warning');
  if (active.has('multiple_degrees_one_institution'))
    add(/\b(?:PhD|MBA|MPP|MPA|MPH|MFA|EdD|BFA|LLB|LLM|JD|BEng|MEng|B\.A\.|B\.S\.|M\.A\.|M\.S\.|Ph\.D\.|J\.D\.|M\.D\.|(?:BA|BS|MA|MS|MD)(?=\s*,|\s+in\s|\s+of\s)|(?:Bachelor|Master)(?:'s|s)?\s+(?:of|in|degree)|Doctorate\s+of|Doctor\s+of|Associate(?:'s|s)?\s+(?:of|in|degree))/gi, 'warning');

  if (!ranges.length) return [{ text, highlight: null }];

  ranges.sort((a, b) => a.start - b.start);

  const segs = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    if (r.start > pos) segs.push({ text: text.slice(pos, r.start), highlight: null });
    segs.push({ text: text.slice(r.start, r.end), highlight: r.severity });
    pos = r.end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), highlight: null });
  return segs;
}

// ─── Resume Preview ───────────────────────────────────────────────────────────

function ResumePreview({ text, flagsFound }) {
  const lines = buildHighlightedLines(text, flagsFound);
  const hasCriticalEmail  = flagsFound.some(f => f.id === 'missing_email');
  const hasCriticalPhone  = flagsFound.some(f => f.id === 'missing_phone');
  const structuralFlags   = flagsFound.filter(f =>
    ['tables', 'multi_column', 'text_boxes', 'graphics_images', 'headers_footers'].includes(f.id)
  );

  return (
    <div className="resume-preview">
      {structuralFlags.length > 0 && (
        <div className="preview-structural-alert">
          <span className="structural-alert-icon">🔴</span>
          <span>
            <strong>Structural issues detected</strong> — these can't be highlighted in text because they affect
            document layout: {structuralFlags.map(f => f.label).join(', ')}
          </span>
        </div>
      )}
      {(hasCriticalEmail || hasCriticalPhone) && (
        <div className="preview-contact-alert">
          {hasCriticalEmail && <span className="contact-badge critical">No email detected</span>}
          {hasCriticalPhone && <span className="contact-badge warning">No phone detected</span>}
        </div>
      )}

      {lines.map((line, i) => {
        if (line.type === 'blank') return <div key={i} className="resume-blank" />;

        const cls = [
          'resume-line',
          `rline-${line.type}`,
          line.lineHighlight ? `line-hl line-hl-${line.lineHighlight}` : '',
        ].filter(Boolean).join(' ');

        const content = line.segments.map((seg, j) =>
          seg.highlight
            ? <mark key={j} className={`hl hl-${seg.highlight}`} title={seg.highlight}>{seg.text}</mark>
            : <span key={j}>{seg.text}</span>
        );

        return (
          <div key={i} className={cls}>
            {line.lineHighlight && <span className={`line-dot line-dot-${line.lineHighlight}`} />}
            {content}
          </div>
        );
      })}
    </div>
  );
}

// ─── Highlight legend ─────────────────────────────────────────────────────────

function HighlightLegend({ flagsFound }) {
  const hasCritical = flagsFound.some(f => f.severity === 'critical');
  const hasWarning  = flagsFound.some(f => f.severity === 'warning');
  const hasRec      = flagsFound.some(f => f.severity === 'recommendation');
  if (!hasCritical && !hasWarning && !hasRec) return null;
  return (
    <div className="highlight-legend">
      <span className="legend-label">Highlights:</span>
      {hasCritical && <span className="legend-item"><mark className="hl hl-critical">■</mark> Critical</span>}
      {hasWarning  && <span className="legend-item"><mark className="hl hl-warning">■</mark> Warning</span>}
      {hasRec      && <span className="legend-item"><mark className="hl hl-recommendation">■</mark> Tip</span>}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [dragOver, setDragOver]       = useState(false);
  const [fileName, setFileName]       = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [resumeText, setResumeText]   = useState('');
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [exporting, setExporting]     = useState(false);  // 'docx' | 'txt' | false

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (!['docx', 'doc', 'pdf'].includes(ext)) {
      setError('Please upload a .docx, .doc, or .pdf file.');
      return;
    }

    setError('');
    setLoading(true);
    setResult(null);
    setFileName(file.name);
    setInputFormat(ext);

    try {
      const parsed = (ext === 'docx' || ext === 'doc') ? await parseDocx(file) : await parsePdf(file);
      setResumeText(parsed.text);
      const analysis = analyzeResume(parsed.text, parsed.meta);
      setResult(analysis);
      track('resume_uploaded', { format: ext, score: analysis.score });
    } catch (err) {
      console.error(err);
      setError('Failed to parse file. ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const handleReset = () => {
    setResumeText('');
    setResult(null);
    setFileName('');
    setInputFormat('');
    setError('');
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const cleanText = generateATSSafeVersion(resumeText);
      if (format === 'docx') {
        await exportToDocx(cleanText, fileName);
      } else {
        exportToTxt(cleanText, fileName);
      }
    } catch (err) {
      setError('Export failed: ' + (err.message || ''));
    } finally {
      setExporting(false);
    }
  };

  const grouped = result ? {
    critical:       result.flagsFound.filter(f => f.severity === 'critical'),
    warning:        result.flagsFound.filter(f => f.severity === 'warning'),
    recommendation: result.flagsFound.filter(f => f.severity === 'recommendation'),
  } : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Workday Resume Auditor</h1>
        <p className="subtitle">Check if your resume survives Workday's ATS parser</p>
      </header>

      <main className="app-main">
        {!resumeText && !loading && (
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <div className="upload-icon">📄</div>
            <p className="upload-title">Drop your resume here</p>
            <p className="upload-sub">Supports .docx, .doc, and .pdf</p>
            <input
              id="file-input"
              type="file"
              accept=".docx,.doc,.pdf"
              onChange={(e) => processFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Analyzing resume…</p>
          </div>
        )}

        {resumeText && result && (
          <div className="content-grid">

            {/* LEFT — Resume Preview */}
            <section className="panel preview-panel">
              <div className="panel-header">
                <h2>Resume Preview</h2>
                <span className="file-badge">{fileName}</span>
              </div>
              <HighlightLegend flagsFound={result.flagsFound} />
              <div className="preview-scroll">
                <ResumePreview text={resumeText} flagsFound={result.flagsFound} />
              </div>
              <button className="btn btn-secondary" onClick={handleReset}>
                Upload different file
              </button>
            </section>

            {/* RIGHT — Score + Flags */}
            <section className="panel results-panel">
              <div className="panel-header">
                <h2>Workday Compatibility</h2>
                <span className="flag-count-badge">
                  {result.flagsFound.length} issue{result.flagsFound.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="score-card" style={{ '--score-color': SCORE_COLOR(result.score) }}>
                <div className="score-number">
                  {result.score.toFixed(1)}<span className="score-denom">/10</span>
                </div>
                <div className="score-label">{SCORE_LABEL(result.score)}</div>
                <div className="score-bar-track">
                  <div className="score-bar-fill" style={{ width: `${result.score * 10}%` }} />
                </div>
              </div>

              {result.flagsFound.length === 0 ? (
                <div className="all-clear">✅ No issues — resume looks ATS-ready!</div>
              ) : (
                <div className="flags-container">
                  {['critical', 'warning', 'recommendation'].map(sev => {
                    const flags = grouped[sev];
                    if (!flags.length) return null;
                    const meta = SEVERITY_META[sev];
                    return (
                      <div key={sev} className="severity-group">
                        <div className="severity-group-label">
                          {meta.dot} {sev.charAt(0).toUpperCase() + sev.slice(1)}
                          <span className="severity-count">{flags.length}</span>
                        </div>
                        <ul className="flags-list">
                          {flags.map((flag, i) => (
                            <li key={i} className={`flag-item ${meta.cls}`}>
                              <div className="flag-top">
                                <strong className="flag-label">{flag.label}</strong>
                                <span className={`flag-badge ${meta.cls}`}>{meta.badge}</span>
                              </div>
                              {flag.detail && <span className="flag-detail">{flag.detail}</span>}
                              <p className="flag-desc">{flag.description}</p>
                              {result.suggestions[result.flagsFound.indexOf(flag)] && (
                                <p className="flag-fix">
                                  Fix: {result.suggestions[result.flagsFound.indexOf(flag)]}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="export-section">
                <div className="export-buttons">
                  <button className="btn btn-primary" onClick={() => handleExport('docx')} disabled={!!exporting}>
                    {exporting === 'docx' ? '⏳ Generating…' : 'Export .docx'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleExport('txt')} disabled={!!exporting}>
                    {exporting === 'txt' ? '⏳ Generating…' : 'Export .txt'}
                  </button>
                </div>
                <ul className="export-notes">
                  <li className="export-note">Fixes formatting issues (symbols, dashes, spacing). Structural issues like stacked roles or stacked degrees must be corrected manually in your resume first.</li>
                  {inputFormat === 'pdf' && (
                    <li className="export-note">PDF uploads: The exported .docx is rebuilt from extracted text only — original formatting is not preserved.</li>
                  )}
                  {(inputFormat === 'docx' || inputFormat === 'doc') && (
                    <li className="export-note">Some layout issues — like multi-column formatting — can't be reliably detected from Word files. If your resume uses columns or text boxes, treat this as a partial check.</li>
                  )}
                </ul>
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>🔒 Your file never leaves your browser — everything is processed locally on your device. Nothing (no data or information) is uploaded, stored, or sent to any server.</p>
        <p>🔧 For broader ATS (applicant tracking system) optimization in your resume and job applications, also check out <a href="https://chromewebstore.google.com/detail/simplify-copilot-autofill/pbanhockgagggenencehbnadejlgchfc" target="_blank" rel="noopener noreferrer">Simplify Copilot</a> and <a href="https://werkal.com" target="_blank" rel="noopener noreferrer">Werkal</a>.</p>
        <p>ℹ️ This tool is not affiliated with Workday, any ATS job portal, Simplify Copilot, or Werkal.</p>
        <p>💬 Have a bug to report or a suggestion? <a href="https://forms.gle/MhKxYwLtiyCQ6EFD7" target="_blank" rel="noopener noreferrer">Let us know here.</a></p>
      </footer>
    </div>
  );
}
