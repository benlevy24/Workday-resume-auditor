# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Serve the production build locally
```

## Architecture

Single-page React app (Vite) that runs entirely in the browser — no backend.

**Key files:**
- `src/scoringEngine.js` — Pure logic. `analyzeResume(text, meta)` returns `{ score, flagsFound, suggestions }`. `generateATSSafeVersion(text)` returns cleaned plain text.
- `src/fileParser.js` — `parseDocx(file)` uses mammoth; `parsePdf(file)` uses pdfjs-dist. Both return `{ text, meta }` where `meta` carries boolean flags (`hasTables`, `hasImages`, `hasMultiColumn`, etc.) consumed by the scoring engine.
- `src/App.jsx` — Single component wiring upload → parse → score → display.

**Data flow:**
```
File drop/upload → parseDocx/parsePdf → { text, meta }
                                              ↓
                                    analyzeResume(text, meta)
                                              ↓
                              { score, flagsFound, suggestions }
                                              ↓
                              Score card + red flag list + fix suggestions
                                              ↓
                            "Generate ATS-Safe Version" → generateATSSafeVersion(text)
```

**pdfjs worker:** The worker is loaded via a relative `new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.js', import.meta.url)` — Vite copies it to `dist/assets/` automatically. Do not switch to the CDN URL.

**Node version constraint:** Node 18.20.4 is in use. pdfjs-dist is pinned to v3 (`pdfjs-dist@3.11.174`) and Vite to v5 — do not upgrade these without also upgrading Node.
