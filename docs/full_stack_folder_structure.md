# MarkFlow Full-Stack Folder Structure

This document summarizes the folder layout and architecture of the **Cloud MarkDown Converter (MarkFlow)** full-stack web application.

The backend uses **zero third-party npm dependencies** (`node_modules` is not required): it runs directly on Node.js 20+ built-in modules (`node:http`, `node:fs`, `node:path`, `node:child_process`, `node:test`) and renders styled PDFs via an installed headless Chromium/Chrome/Edge binary (`--headless --print-to-pdf`), with a built-in pure-JS PDF 1.4 fallback when no browser binary is present.

The application is stateless on the server: no user login, user profiles, or server-side document databases are stored. Document drafts and editor preferences stay in the browser (`localStorage`), while template definitions and Markdown-to-PDF rendering live on the backend.

---

## 1. Repository Tree

```text
SWE40006-Group3/
├── docs/
│   ├── webapp_implementation_plan.md     # Original architecture plan and API contract
│   └── full_stack_folder_structure.md    # Summary of the full-stack directory structure
└── CloudMarkDownConverter/
    ├── .gitkeep
    ├── backend/                          # Zero-dependency Node.js backend (no node_modules)
    │   ├── .gitignore                    # Ignores logs and local artifacts
    │   ├── package.json                  # Project metadata and npm start / npm test scripts
    │   ├── server.js                     # Built-in node:http server, API routes, and static frontend host
    │   ├── converter.js                  # Pure-JS Markdown parser, template builder, and headless PDF converter
    │   ├── templates/                    # Print-optimized HTML/CSS templates for PDF generation
    │   │   ├── minimal.html              # Minimal sans-serif layout (also aliased as "default")
    │   │   ├── academic.html             # Academic serif layout
    │   │   ├── business.html             # Business report layout (also aliased as "report")
    │   │   ├── resume.html               # Compact single-page Resume / CV layout
    │   │   └── tech.html                 # Technical documentation layout
    │   └── tests/                        # Automated tests using node:test + node:assert
    │       ├── health.test.js            # Tests GET /health, GET /api/templates, and static serving
    │       └── converter.test.js         # Tests Markdown parsing, sanitization, templates, and POST /api/convert
    └── frontend/                         # Vanilla HTML5 + Tailwind CSS + JS client UI
        ├── index.html                    # Landing page and drag-and-drop Markdown file loader
        ├── workspace.html                # Split-screen Markdown editor, formatting toolbar, and live preview
        ├── templates.html                # Template gallery UI and interactive preview modal
        ├── export.html                   # PDF page settings UI and server-side PDF download trigger
        ├── documents.html                # Browser-local document library (search, sort, rename, duplicate, delete)
        ├── settings.html                 # Browser-local theme, editor, and PDF default preferences
        └── markflow.js                   # Shared client helpers, live preview renderer, localStorage wrapper, and API client
```

---

## 2. Backend Responsibilities (`CloudMarkDownConverter/backend/`)

| File / Folder | Role |
| :--- | :--- |
| `package.json` | Defines `npm start` (`node server.js`) and `npm test` (`node --test tests`) with zero external dependencies. |
| `server.js` | Built-in `node:http` server (`createServer()`), exposing `/health`, `/api/templates`, and `/api/convert`, enforcing the 2 MB payload limit, and serving `../frontend` as static files. |
| `converter.js` | Pure-JS Markdown parser (escaping raw HTML and blocking unsafe link/image URLs), HTML template injector, headless Chrome/Edge/Chromium PDF renderer, and built-in PDF 1.4 fallback. |
| `templates/*.html` | Five print-optimized HTML/CSS layouts (`minimal`, `academic`, `business`, `resume`, `tech`) with `@page` sizing, margin, font, and page-break rules. |
| `tests/*.test.js` | Unit and HTTP integration tests verifying health checks, template listing, Markdown sanitization, validation errors, and `%PDF-` binary output. |

### API Endpoints

- `GET /health` — Returns `{ "status": "UP", "version": "1.0.0" }`.
- `GET /api/templates` — Returns the array of 5 styling templates (`minimal`, `academic`, `business`, `resume`, `tech`) with styling tokens and descriptions.
- `POST /api/convert` — Accepts `{ markdown, template, size, orient, margin, font, title }`, converts Markdown into HTML, renders a styled PDF, and streams `application/pdf` back as an attachment.

---

## 3. Frontend Responsibilities (`CloudMarkDownConverter/frontend/`)

| File | Role |
| :--- | :--- |
| `index.html` | Entry page with quick navigation and drag-and-drop upload for `.md`, `.markdown`, and `.txt` files (up to 2 MB). |
| `workspace.html` | Markdown editor with formatting toolbar, editor/split/preview layout toggle, template selector, and local draft saving. |
| `templates.html` | Fetches template metadata from `GET /api/templates`, renders scaled previews, and lets users apply a template. |
| `export.html` | Configures paper size (`A4`, `Letter`, `Legal`), orientation, margins, font, and template, then calls `POST /api/convert` to download the rendered PDF. |
| `documents.html` | Lists, searches, sorts, opens, renames, duplicates, and deletes drafts stored locally in `localStorage`. |
| `settings.html` | Stores theme (`light`, `dark`, `system`), editor preferences, and default PDF export options in `localStorage`. |
| `markflow.js` | Client-side utilities (`$`, `LS`, `S`, `setS`), fast live-preview Markdown renderer (`md()`), page scaling (`fit()`), template sync (`MF.loadTemplates()`), and PDF export client (`MF.exportPdf()`). |

---

## 4. Separation of Concerns (Frontend vs. Backend)

- **Moved to backend**: Server-side PDF generation (`POST /api/convert` + `converter.js`) and canonical print HTML/CSS templates (`backend/templates/*.html` + `GET /api/templates`) replaced the frontend's temporary `window.print()` (`printDoc()` / `#print-root`) workaround.
- **Kept on frontend**: Instant in-browser Markdown live preview (`md()` / `applyTpl()` in `markflow.js`), UI pages, and browser-only `localStorage` persistence for drafts and preferences (no user accounts or server storage).

---

## 5. Local Setup & Verification

No `npm install` or `node_modules` directory is needed (requires Node.js 20+):

```bash
cd CloudMarkDownConverter/backend
npm test
npm start
# Open http://localhost:3000 in a browser
```
