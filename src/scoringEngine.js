// Workday ATS Scoring Engine
// Scans resume text/structure for red flags that break Workday autofill
// Severity: 'critical' | 'warning' | 'recommendation'

export const STANDARD_SECTION_KEYWORDS = [
  'experience', 'work experience', 'employment', 'professional experience',
  'education', 'skills', 'summary', 'objective', 'certifications',
  'projects', 'volunteer', 'awards', 'publications', 'references',
  'technical skills', 'core competencies', 'professional summary',
  'work history', 'career', 'qualifications', 'achievements', 'accomplishments',
  'languages', 'interests', 'activities', 'leadership', 'training',
];

export const RED_FLAGS = {
  // ── Critical ────────────────────────────────────────────────────────────
  TABLES: {
    id: 'tables',
    severity: 'critical',
    label: 'Tables detected',
    description: 'Tables cause Workday to merge cells or silently skip content during autofill.',
    penalty: 3,
  },
  MULTI_COLUMN: {
    id: 'multi_column',
    severity: 'critical',
    label: 'Multi-column layout',
    description: 'Workday reads top-to-bottom, left-to-right — two-column layouts produce garbled, merged output.',
    penalty: 3,
  },
  TEXT_BOXES: {
    id: 'text_boxes',
    severity: 'critical',
    label: 'Text boxes or floating shapes',
    description: 'Floating text boxes are invisible to Workday\'s parser. Any content inside will be skipped.',
    penalty: 2,
  },
  MISSING_EMAIL: {
    id: 'missing_email',
    severity: 'critical',
    label: 'No email address detected',
    description: 'Workday needs an email to autofill your contact section. Without one, autofill will fail entirely.',
    penalty: 2,
  },

  // ── Warning ─────────────────────────────────────────────────────────────
  GRAPHICS_IMAGES: {
    id: 'graphics_images',
    severity: 'warning',
    label: 'Images or graphics present',
    description: 'Profile photos, logos, and icons are completely invisible to ATS parsers.',
    penalty: 2,
  },
  HEADERS_FOOTERS: {
    id: 'headers_footers',
    severity: 'warning',
    label: 'Headers/footers with key info',
    description: 'Workday often ignores document headers and footers — contact info placed there gets missed.',
    penalty: 1,
  },
  SPECIAL_CHARS: {
    id: 'special_chars',
    severity: 'warning',
    label: 'Excessive special characters or symbols',
    description: 'Non-standard bullets and icons (●, ✦, ★) can corrupt surrounding text during parsing.',
    penalty: 1,
  },
  UNUSUAL_SECTION_HEADERS: {
    id: 'unusual_section_headers',
    severity: 'warning',
    label: 'Non-standard section headings',
    description: 'Workday uses section names to categorize content. Headings that don\'t match expected labels (Experience, Education, Skills, etc.) may cause fields to autofill into the wrong section or be skipped.',
    penalty: 1,
  },
  MISSING_DATES: {
    id: 'missing_dates',
    severity: 'warning',
    label: 'Missing or ambiguous dates',
    description: 'Workday requires parseable date ranges for job history autofill. Missing dates break the timeline.',
    penalty: 1,
  },
  MISSING_PHONE: {
    id: 'missing_phone',
    severity: 'warning',
    label: 'No phone number detected',
    description: 'Workday looks for a phone number in your contact section to autofill.',
    penalty: 1,
  },
  INCONSISTENT_DATE_FORMATS: {
    id: 'inconsistent_date_formats',
    severity: 'warning',
    label: 'Inconsistent date formats',
    description: 'Mixing "Jan 2020", "01/2020", and "2020" in the same resume makes timeline parsing unreliable.',
    penalty: 0.5,
  },
  SKILL_RATINGS: {
    id: 'skill_ratings',
    severity: 'warning',
    label: 'Skill ratings or visual progress bars',
    description: 'Skill bars (●●●○○, ★★★☆☆, 4/5) are read as literal characters, fragmenting your skills list.',
    penalty: 1,
  },

  // ── Recommendation ───────────────────────────────────────────────────────
  HYPERLINKS: {
    id: 'hyperlinks',
    severity: 'recommendation',
    label: 'Embedded hyperlinks',
    description: 'Hyperlink formatting can produce garbled anchor text in Workday\'s parser. Use plain-text URLs.',
    penalty: 0.5,
  },
  DECORATIVE_DIVIDERS: {
    id: 'decorative_dividers',
    severity: 'recommendation',
    label: 'Decorative divider lines',
    description: 'Repeated characters used as visual separators (════, ────, ****) are parsed as content.',
    penalty: 0,
  },
  PRESENT_KEYWORD: {
    id: 'present_keyword',
    severity: 'recommendation',
    label: '"Present" used as job end date',
    description: 'Some ATS versions cannot parse "Present" as a date. Prefer "Current" or an actual month/year.',
    penalty: 0,
  },
  REFERENCES_UPON_REQUEST: {
    id: 'references_upon_request',
    severity: 'recommendation',
    label: '"References available upon request"',
    description: 'Outdated phrase that wastes space. Modern ATS systems and recruiters don\'t need this.',
    penalty: 0,
  },
  RESUME_TOO_LONG: {
    id: 'resume_too_long',
    severity: 'recommendation',
    label: 'Resume may exceed 2 pages',
    description: 'Recruiters and ATS systems favor concise resumes. Content on page 3+ is often overlooked.',
    penalty: 0.5,
  },
  MULTIPLE_DEGREES_ONE_INSTITUTION: {
    id: 'multiple_degrees_one_institution',
    severity: 'warning',
    label: 'Multiple degrees under one institution',
    description: 'Workday creates one education record per institution name. Listing two degrees (e.g. BA + MPP) under one school entry will autofill as a single degree — the second is lost.',
    penalty: 1,
  },
  MULTIPLE_ROLES_ONE_ORG: {
    id: 'multiple_roles_one_org',
    severity: 'warning',
    label: 'Multiple roles stacked under one organization',
    description: 'Workday creates one work entry per job block. Promotions or title changes listed under a single company name autofill as one position — earlier titles are dropped.',
    penalty: 1,
  },
  INFLATED_JOB_TITLES: {
    id: 'inflated_job_titles',
    severity: 'recommendation',
    label: 'Non-standard job title language',
    description: 'Terms like "Ninja", "Guru", "Wizard", or "Rockstar" are rarely in Workday\'s job title database and may not autofill correctly.',
    penalty: 0,
  },
  NO_SUMMARY: {
    id: 'no_summary',
    severity: 'recommendation',
    label: 'No summary or objective section',
    description: 'A short summary at the top gives Workday context to improve keyword matching.',
    penalty: 0,
  },
  EM_EN_DASH: {
    id: 'em_en_dash',
    severity: 'recommendation',
    label: 'Em or en dashes used as separators',
    description: 'Em dashes (—) and en dashes (–) can encode as garbled characters ("â€"") in some ATS versions. Use plain hyphens (-) for date ranges and separators.',
    penalty: 0,
  },
  PIPE_SEPARATOR: {
    id: 'pipe_separator',
    severity: 'recommendation',
    label: 'Pipe characters "|" used as separators',
    description: 'Pipes are usually fine in contact lines, but some ATS versions treat "|" as literal text rather than a separator — occasionally breaking phone or email field detection. Consider commas or line breaks if you\'re seeing autofill issues.',
    penalty: 0,
  },
  FRAGMENTED_PDF_LINES: {
    id: 'fragmented_pdf_lines',
    severity: 'warning',
    label: 'Fragmented lines from PDF parsing',
    description: 'The PDF parser split sentences mid-line. Workday sees the same breaks — bullet points and summaries will paste as disconnected fragments, requiring manual cleanup.',
    penalty: 1,
  },
  NO_SKILLS_SECTION: {
    id: 'no_skills_section',
    severity: 'recommendation',
    label: 'No skills section detected',
    description: 'Workday has a dedicated Skills field it autofills from a clearly labeled Skills section. Without one, your skills won\'t be captured during autofill.',
    penalty: 0,
  },
  YEAR_ONLY_DATES: {
    id: 'year_only_dates',
    severity: 'warning',
    label: 'Year-only date ranges',
    description: 'Date ranges like "2019 – 2022" lack the month Workday needs to populate Start/End Date fields accurately. Use "Jan 2019 – Mar 2022" format.',
    penalty: 0.5,
  },
};

// ── Regexes ──────────────────────────────────────────────────────────────────

// Excludes common bullet chars (●◉■▪◆•) — only flags truly decorative/icon symbols
const SPECIAL_CHAR_REGEX = /[★✦✓✗✔✘❖⊙⬤▶◀►▸]/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
// Requires separators between groups so "2020-2024" doesn't match
const PHONE_REGEX = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/;

// Date format patterns
const DATE_FORMATS = {
  monthYear: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(19|20)\d{2}\b/gi,
  mmSlashYYYY: /\b(0?[1-9]|1[0-2])\/(19|20)\d{2}\b/g,
  yearOnly: /\b(19|20)\d{2}\b/g,
  mmDashYYYY: /\b(0?[1-9]|1[0-2])-(19|20)\d{2}\b/g,
};

// Skill ratings: repeated symbols OR fraction patterns (e.g. ●●●○○, 4/5, 8/10)
const SKILL_RATING_REGEX = /[○◎☆✩✪]{2,}|●{2,}|(\d\s*\/\s*[3-9])|(\d\s*out\s*of\s*\d)/gi;
const DIVIDER_REGEX = /^[\s]*[=\-─━═~*_]{5,}[\s]*$/m;
const INFLATED_TITLE_REGEX = /\b(ninja|guru|wizard|rockstar|rock star|jedi|evangelist|unicorn|superhero|hacker)\b/gi;

/**
 * @param {string} text - Plain text from the document
 * @param {object} meta - { hasTables, hasImages, hasMultiColumn, hasTextBoxes, hasHeaderFooter, pageCount }
 * @returns {{ score: number, flagsFound: object[], suggestions: string[] }}
 */
export function analyzeResume(text, meta = {}) {
  const flagsFound = [];
  const lines = text.split('\n').filter(l => l.trim());

  // ── Structural (from parser metadata) ──────────────────────────────────
  if (meta.hasTables)       flagsFound.push(RED_FLAGS.TABLES);
  if (meta.hasMultiColumn)  flagsFound.push(RED_FLAGS.MULTI_COLUMN);
  if (meta.hasTextBoxes)    flagsFound.push(RED_FLAGS.TEXT_BOXES);
  if (meta.hasImages)       flagsFound.push(RED_FLAGS.GRAPHICS_IMAGES);
  if (meta.hasHeaderFooter) flagsFound.push(RED_FLAGS.HEADERS_FOOTERS);

  // ── Fragmented lines (PDF only) ─────────────────────────────────────────
  if (meta.isPdf) {
    let fragCount = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      const t = lines[i].trim();
      if (t.length < 25 || /[.!?:]$/.test(t)) continue;
      const next = lines.slice(i + 1).find(l => l.trim());
      if (next && /^[a-z]/.test(next.trim())) fragCount++;
    }
    if (fragCount >= 2) {
      flagsFound.push({ ...RED_FLAGS.FRAGMENTED_PDF_LINES, detail: `~${fragCount} broken line${fragCount !== 1 ? 's' : ''}` });
    }
  }

  // ── Contact info ────────────────────────────────────────────────────────
  if (!EMAIL_REGEX.test(text)) {
    flagsFound.push(RED_FLAGS.MISSING_EMAIL);
  }
  if (!PHONE_REGEX.test(text)) {
    flagsFound.push(RED_FLAGS.MISSING_PHONE);
  }

  // ── Special characters ──────────────────────────────────────────────────
  const specialCharMatches = text.match(SPECIAL_CHAR_REGEX) || [];
  if (specialCharMatches.length > 3) {
    flagsFound.push({
      ...RED_FLAGS.SPECIAL_CHARS,
      detail: `${specialCharMatches.length} symbols found`,
    });
  }

  // ── Skill ratings / progress bars ───────────────────────────────────────
  if (SKILL_RATING_REGEX.test(text)) {
    flagsFound.push(RED_FLAGS.SKILL_RATINGS);
  }

  // ── Section headings — only flag ALL CAPS lines that don't match known keywords ──
  const unusualHeadings = lines.slice(1).filter(l => {
    const t = l.trim();
    if (t.length < 3 || t.length > 40) return false;
    if (/\d/.test(t)) return false;           // skip dates/years
    if (/[@,;|/\\]/.test(t)) return false;    // skip contact/bullet lines
    const letters = t.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 3) return false;
    if (letters !== letters.toUpperCase()) return false;  // must be ALL CAPS
    const lower = t.toLowerCase();
    return !STANDARD_SECTION_KEYWORDS.some(kw => lower.includes(kw));
  });
  if (unusualHeadings.length > 0) {
    flagsFound.push({
      ...RED_FLAGS.UNUSUAL_SECTION_HEADERS,
      detail: unusualHeadings.slice(0, 3).map(h => `"${h.trim()}"`).join(', '),
    });
  }

  // ── No summary section ───────────────────────────────────────────────────
  const hasSummaryKeyword = /\b(summary|objective|profile|overview|about|bio|introduction)\b/i.test(text);
  // Also detect an implicit summary: sentence-length content in the first ~8 non-empty lines
  // before the first ALL-CAPS section header (i.e. a paragraph without a label)
  let foundImplicitSummary = false;
  if (!hasSummaryKeyword) {
    const preHeaderLines = [];
    for (let li = 1; li < Math.min(lines.length, 12); li++) {
      const t = lines[li].trim();
      const letters = t.replace(/[^a-zA-Z]/g, '');
      // Stop when we hit an ALL CAPS heading
      if (t.length < 40 && letters.length > 2 && letters === letters.toUpperCase()) break;
      preHeaderLines.push(t);
    }
    foundImplicitSummary = preHeaderLines.some(l => l.length > 50 && /[.!]/.test(l));
  }
  if (!hasSummaryKeyword && !foundImplicitSummary) flagsFound.push(RED_FLAGS.NO_SUMMARY);

  // ── Dates ────────────────────────────────────────────────────────────────
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g) || [];
  if (yearMatches.length < 2) {
    flagsFound.push(RED_FLAGS.MISSING_DATES);
  } else {
    // Check inconsistent date formats
    const monthYearFound = DATE_FORMATS.monthYear.test(text);
    const mmSlashFound   = DATE_FORMATS.mmSlashYYYY.test(text);
    const mmDashFound    = DATE_FORMATS.mmDashYYYY.test(text);
    const formatCount = [monthYearFound, mmSlashFound, mmDashFound].filter(Boolean).length;
    if (formatCount >= 2) {
      flagsFound.push(RED_FLAGS.INCONSISTENT_DATE_FORMATS);
    }
  }

  // ── "Present" as end date ────────────────────────────────────────────────
  if (/\bpresent\b/i.test(text)) {
    flagsFound.push(RED_FLAGS.PRESENT_KEYWORD);
  }

  // ── Decorative dividers ──────────────────────────────────────────────────
  if (DIVIDER_REGEX.test(text)) {
    flagsFound.push(RED_FLAGS.DECORATIVE_DIVIDERS);
  }

  // ── Em / en dashes ───────────────────────────────────────────────────────
  const emEnDashMatches = text.match(/[–—]/g) || [];
  if (emEnDashMatches.length > 0) {
    flagsFound.push({ ...RED_FLAGS.EM_EN_DASH, detail: `${emEnDashMatches.length} found` });
  }

  // ── Pipe separators ──────────────────────────────────────────────────────
  const pipeMatches = text.match(/\|/g) || [];
  if (pipeMatches.length >= 2) {
    flagsFound.push({ ...RED_FLAGS.PIPE_SEPARATOR, detail: `${pipeMatches.length} pipes found` });
  }

  // ── Hyperlinks ───────────────────────────────────────────────────────────
  if (/https?:\/\//i.test(text)) {
    flagsFound.push(RED_FLAGS.HYPERLINKS);
  }

  // ── "References upon request" ─────────────────────────────────────────────
  if (/references\s+(are\s+)?(available\s+)?upon\s+request/i.test(text)) {
    flagsFound.push(RED_FLAGS.REFERENCES_UPON_REQUEST);
  }

  // ── Resume length (from page count or text length heuristic) ─────────────
  const pageCount = meta.pageCount || Math.ceil(text.length / 3000);
  if (pageCount > 2) {
    flagsFound.push({
      ...RED_FLAGS.RESUME_TOO_LONG,
      detail: `~${pageCount} pages`,
    });
  }

  // ── Inflated job titles ──────────────────────────────────────────────────
  const inflatedMatches = text.match(INFLATED_TITLE_REGEX) || [];
  if (inflatedMatches.length > 0) {
    flagsFound.push({
      ...RED_FLAGS.INFLATED_JOB_TITLES,
      detail: [...new Set(inflatedMatches.map(m => m.toLowerCase()))].join(', '),
    });
  }

  // ── Multiple degrees under one institution ──────────────────────────────
  // Split into groups to allow proper trailing word boundaries on abbreviations.
  // Without a trailing \b, "MEd" matches the start of "Medicaid".
  const DEGREE_REGEX = /\b(?:PhD|MBA|MPP|MPA|MPH|MFA|MEd|EdD|BFA|LLB|LLM|JD|BEng|MEng)\b|\bB\.A\.|B\.S\.|M\.A\.|M\.S\.|Ph\.D\.|J\.D\.|M\.D\.|\b(?:BA|BS|MA|MS|MD)(?=\s*,|\s+in\s|\s+of\s)|(?:Bachelor|Master)(?:'s|s)?\s+(?:of|in|degree)|(?:Doctorate|Doctor\s+of)\b|(?:Associate(?:'s|s)?)\s+(?:of|in|degree)/gi;
  const INSTITUTION_RE = /\b(university|college|institute|school|academy)\b/i;
  const degreeMatches      = [...text.matchAll(DEGREE_REGEX)];
  // Count unique non-bullet lines that mention an institution keyword.
  // Using per-line .test() (no g flag) avoids inflated counts from multiple
  // keyword matches on the same line or false matches in work descriptions.
  const institutionLineCount = lines
    .filter(l => !/^[*•·\-–]/.test(l.trim()))
    .filter(l => INSTITUTION_RE.test(l)).length;
  // Normalize to degree LEVEL so "Master's degree" + "Master of Public Policy" = 1, not 2
  function normalizeDegreeLevel(raw) {
    const m = raw.toLowerCase();
    if (/bachelor|b\.a\.|b\.s\.|^ba$|^bs$/.test(m)) return 'bachelor';
    if (/master|m\.a\.|m\.s\.|^mpp$|^mpa$|^mph$|^mfa$|^med$|^ma$|^ms$|^mba$/.test(m)) return 'master';
    if (/ph\.?d|doctorate|doctor\s+of/.test(m)) return 'doctorate';
    if (/^j\.?d\.?$/.test(m)) return 'juris doctor';
    if (/^m\.?d\.?$/.test(m)) return 'medical doctor';
    if (/^llb$|^llm$/.test(m)) return 'law';
    return m;
  }
  const uniqueDegrees = new Set(degreeMatches.map(m => normalizeDegreeLevel(m[0].trim())));
  if (uniqueDegrees.size >= 2 && institutionLineCount >= 1) {
    flagsFound.push({
      ...RED_FLAGS.MULTIPLE_DEGREES_ONE_INSTITUTION,
      detail: `${uniqueDegrees.size} degree levels (${[...uniqueDegrees].join(', ')}), ~${institutionLineCount} institution${institutionLineCount !== 1 ? 's' : ''}`,
    });
  }

  // ── Multiple roles stacked under one org ─────────────────────────────────
  // Detects the common pattern: one org header line with a date range, followed by
  // multiple role/title lines (no dates, no bullets) within that block.
  // e.g.  "CMS - NY  04/2023 - 07/2025"
  //         "Health Insurance Specialist"   ← title line
  //         "Social Science Research Analyst" ← second title line → FLAG
  // Handles: "07/2025 - 12/2025", "2022 - Present", "Jan 2022 – Present"
  const DATE_RANGE_LINE_RE = /\b(?:\d{1,2}\/)?(?:19|20)\d{2}\s*[-–—]\s*(?:(?:\d{1,2}\/)?(?:19|20)\d{2}|present|current)\b/i;
  const orgHeaderIndices = lines
    .map((l, i) => (DATE_RANGE_LINE_RE.test(l) ? i : -1))
    .filter(i => i >= 0);

  // Find section header lines (ALL CAPS short lines like "EDUCATION", "SKILLS")
  const sectionHeaderIndices = new Set(
    lines.map((l, i) => {
      const t = l.trim();
      const letters = t.replace(/[^a-zA-Z]/g, '');
      return (t.length < 40 && letters.length > 2 && letters === letters.toUpperCase() && !DATE_RANGE_LINE_RE.test(t)) ? i : -1;
    }).filter(i => i >= 0)
  );

  let hasStackedRoles = false;
  for (let k = 0; k < orgHeaderIndices.length && !hasStackedRoles; k++) {
    const blockStart = orgHeaderIndices[k] + 1;
    // End block at next org header OR next section header — whichever comes first
    const nextOrg = k + 1 < orgHeaderIndices.length ? orgHeaderIndices[k + 1] : lines.length;
    const nextSection = lines.slice(blockStart, nextOrg).findIndex((_, relIdx) =>
      sectionHeaderIndices.has(blockStart + relIdx)
    );
    const blockEnd = nextSection >= 0 ? blockStart + nextSection : nextOrg;
    const block      = lines.slice(blockStart, blockEnd);
    const blockText  = block.join(' ');

    // Skip education blocks — but only check non-bullet lines so "Law School Fellows"
    // in a work bullet doesn't cause a real experience block to be skipped
    const nonBulletBlockText = block.filter(l => !/^[*•·\-–]/.test(l.trim())).join(' ');
    if (/\b(university|college|institute|school|academy)\b/i.test(nonBulletBlockText)) continue;

    // Count title-like lines: not a bullet, not too long, not a date range, not empty
    const titleLines = block.filter(l => {
      const t = l.trim();
      if (!t || t.length < 5 || t.length > 120) return false;
      if (/^[*•·\-–]/.test(t)) return false;
      if (DATE_RANGE_LINE_RE.test(t)) return false;
      return true;
    });

    if (titleLines.length >= 2) hasStackedRoles = true;
  }
  if (hasStackedRoles) flagsFound.push(RED_FLAGS.MULTIPLE_ROLES_ONE_ORG);

  // ── No skills section ─────────────────────────────────────────────────────
  const SKILLS_HEADER_RE = /^(technical\s+)?skills?\s*:?$|^core\s+competencies\s*:?$|^areas?\s+of\s+expertise\s*:?$|^competencies\s*:?$/i;
  const hasSkillsSection = lines.slice(1).some(l => SKILLS_HEADER_RE.test(l.trim()));
  if (!hasSkillsSection) flagsFound.push(RED_FLAGS.NO_SKILLS_SECTION);

  // ── Year-only date ranges ─────────────────────────────────────────────────
  // Flag date-range lines that have no month prefix (e.g. "2019 – 2022" instead of "Jan 2019 – Mar 2022")
  // Workday requires month + year to correctly populate Start Date and End Date fields.
  const MONTH_PREFIX_RE = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(19|20)\d{2}|(?:0?[1-9]|1[0-2])[\/\-](19|20)\d{2}/i;
  const yearOnlyRangeCount = lines.filter(l =>
    DATE_RANGE_LINE_RE.test(l) && !MONTH_PREFIX_RE.test(l)
  ).length;
  if (yearOnlyRangeCount > 0) {
    flagsFound.push({
      ...RED_FLAGS.YEAR_ONLY_DATES,
      detail: `${yearOnlyRangeCount} date range${yearOnlyRangeCount !== 1 ? 's' : ''} use year-only format`,
    });
  }

  // ── Score: 10.0, deduct penalties, round to 0.5 increments ──────────────
  const totalPenalty = flagsFound.reduce((sum, f) => sum + (f.penalty || 0), 0);
  const raw = Math.max(0, 10 - totalPenalty);
  const score = Math.round(raw * 2) / 2; // 0.5 increments

  // ── Suggestions ──────────────────────────────────────────────────────────
  const suggestions = flagsFound.map(f => {
    switch (f.id) {
      case 'tables':                   return 'Replace all tables with plain bulleted lists.';
      case 'multi_column':             return 'Convert to a single-column layout — no side-by-side sections.';
      case 'text_boxes':               return 'Move all text-box content into the main document body.';
      case 'missing_email':            return 'Add your email address in a plain-text contact section at the top.';
      case 'graphics_images':          return 'Remove all images, profile photos, logos, and icons.';
      case 'headers_footers':          return 'Move contact info from headers/footers into the main body.';
      case 'special_chars':            return 'Replace decorative symbols with plain hyphens (-) or standard bullets.';
      case 'unusual_section_headers':  return 'Use standard headings: Experience, Education, Skills, Summary.';
      case 'missing_dates':            return 'Add date ranges (e.g. "Jan 2020 – Mar 2023") to all positions.';
      case 'missing_phone':            return 'Add your phone number to your contact section.';
      case 'inconsistent_date_formats':return 'Standardize all dates to "Mon YYYY" format (e.g. "Jan 2020 – Mar 2023").';
      case 'skill_ratings':            return 'Remove visual skill ratings. List skills as plain comma-separated text.';
      case 'hyperlinks':               return 'Replace hyperlinks with plain-text URLs.';
      case 'decorative_dividers':      return 'Remove decorative divider lines (====, ───, ***).';
      case 'present_keyword':          return 'Replace "Present" with "Current" or the actual month/year.';
      case 'references_upon_request':  return 'Remove "References available upon request" — it\'s implicit.';
      case 'resume_too_long':          return 'Trim to 2 pages. Prioritize recent and relevant experience.';
      case 'multiple_degrees_one_institution': return 'List each degree as a separate education entry with the institution name repeated — Workday needs one entry per degree.';
      case 'multiple_roles_one_org':   return 'Separate each role into its own entry with the company name repeated. Workday autofills one position per job block.';
      case 'inflated_job_titles':      return `Replace informal title terms (${f.detail}) with standard job titles.`;
      case 'no_summary':               return 'Add a 2–3 sentence professional summary at the top.';
      case 'em_en_dash':              return 'Replace em/en dashes with plain hyphens (-), especially in date ranges.';
      case 'pipe_separator':          return 'Replace pipe separators (|) with commas or line breaks.';
      case 'fragmented_pdf_lines':    return 'Upload as .docx instead — PDF line breaks are baked into the file and can\'t be auto-fixed. If you must use PDF, manually join broken lines in the source document.';
      case 'no_skills_section':       return 'Add a clearly labeled "Skills" section. Workday autofills its Skills field by scanning for that heading.';
      case 'year_only_dates':         return `Add months to all date ranges — use "Jan 2019 – Mar 2022" instead of "2019 – 2022". Workday needs the month to fill Start Date and End Date fields.`;
      default:                         return f.description;
    }
  });

  return { score, flagsFound, suggestions };
}

/**
 * Generate an ATS-safe plain text version of the resume.
 */
export function generateATSSafeVersion(text) {
  let clean = text;

  // Replace special bullets/symbols with hyphens
  clean = clean.replace(SPECIAL_CHAR_REGEX, '-');

  // Remove skill rating patterns
  clean = clean.replace(/[●◉○◎★☆✩✪]{2,}/g, '');

  // Remove decorative dividers
  clean = clean.replace(/^[\s]*[=\-─━═~*_]{5,}[\s]*$/gm, '');

  // Strip hyperlink formatting (keep bare URL)
  clean = clean.replace(/https?:\/\/(\S+)/g, (_, rest) => rest.split('/')[0]);

  // Replace em/en dashes with hyphens
  clean = clean.replace(/[–—]/g, '-');

  // Replace pipe separators with commas
  clean = clean.replace(/\s*\|\s*/g, ', ');

  // Replace smart quotes with straight quotes
  clean = clean.replace(/[""]/g, '"').replace(/['']/g, "'");

  // Replace "Present" date references with "Current"
  clean = clean.replace(/\bPresent\b/g, 'Current').replace(/\bpresent\b/g, 'current');

  // Remove "References available upon request"
  clean = clean.replace(/references\s+(are\s+)?(available\s+)?upon\s+request[.\s]*/gi, '');

  // Normalize multiple spaces
  clean = clean.replace(/[ \t]{2,}/g, ' ');

  // Normalize multiple blank lines
  clean = clean.replace(/\n{3,}/g, '\n\n');

  // Trim each line
  clean = clean
    .split('\n')
    .map(l => l.trim())
    .join('\n');

  return clean.trim();
}
