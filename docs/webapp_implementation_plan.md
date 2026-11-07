# Web App Implementation Plan: Cloud MarkDown Converter

A lightweight, stateless web application that converts Markdown into styled, standard A4 PDFs. Designed with zero build steps, fast CI/CD execution, and seamless Blue-Green deployments on AWS.

---

## 1. Tech Stack

* **Frontend**: Vanilla HTML5, CSS3, JavaScript (no build step, no npm bloat).
  * `marked.js` (instant client-side preview).
  * `highlight.js` (code syntax highlighting).
* **Backend**: Node.js (v20 LTS) + Express.js.
* **PDF Rendering**: Headless Chromium via `puppeteer` (A4 format, standard margins, embedded fonts).
* **Testing**: Node.js 20 built-in test runner (`node:test` + `node:assert`, run via `npm test`). 

---

## 2. Project File Structure

All app code goes into `SWE40006-Group3/CloudMarkDownConverter/`:

```text
SWE40006-Group3/
├── docs/                      
└── CloudMarkDownConverter/    # Web app source code
    ├── package.json
    ├── server.js              # Express app & API routes
    ├── converter.js           # Markdown-to-PDF logic via Puppeteer
    ├── public/                # Frontend UI (served statically by Express)
    │   ├── index.html         # Split-screen UI (editor + preview)
    │   ├── style.css          # Clean modern styling
    │   └── script.js          # Live preview, template switch, download handler
    ├── templates/             # Print-optimized HTML/CSS templates
    │   ├── default.html       # Clean minimal layout
    │   ├── resume.html        # Professional 2-column CV layout
    │   └── report.html        # Technical report layout
    └── tests/                 # Automated tests for Jenkins CI
        ├── health.test.js     # Validates GET /health
        └── converter.test.js  # Validates markdown parsing & PDF output
```

---

## 3. Endpoints & API Contract

### `GET /health`
* **Purpose**: AWS ALB target group health checks & staging validation.
* **Response**: `200 OK`
```json
{
  "status": "UP",
  "version": "1.0.0"
}
```

### `GET /api/templates`
* **Purpose**: Returns available styling templates.
* **Response**: `200 OK`
```json
[
  {"id": "default", "name": "Clean Minimal"},
  {"id": "resume", "name": "Modern Resume"},
  {"id": "report", "name": "Technical Report"}
]
```

### `POST /api/convert`
* **Purpose**: Converts markdown to styled PDF and streams the file back.
* **Request Body**:
```json
{
  "markdown": "# Hello World\nThis is sample text.",
  "template": "resume"
}
```
* **Response**: `200 OK`, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="document.pdf"`

---

## 4. Work Breakdown

### Task A: Backend & PDF Engine (`server.js`, `converter.js`)
* Initialize Express server on port `3000`.
* Implement `/health`, `/api/templates`, and `/api/convert`.
* Use Puppeteer with launch flags: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`.
* Compile markdown to HTML using `marked`, inject into the selected template, and render A4 PDF (`printBackground: true`).

### Task B: Templates & Frontend UI (`public/`, `templates/`)
* **Templates**: Build `default.html`, `resume.html`, and `report.html` with clean `@media print` CSS rules (A4 page sizing, standard fonts).
* **UI**: Create split-screen layout:
  * Left: Markdown editor textarea + file upload button.
  * Right: Live HTML preview container.
  * Header/Toolbar: Template dropdown, "Download PDF" button, and "Load Sample" buttons (for fast 1-click presentation demos).
* **Client Auto-Save**: Save current draft to browser `localStorage`.

### Task C: Automated Tests (`tests/`)
* **Runner**: Node.js 20 built-in test runner (`node:test` + `node:assert`). Zero extra dependencies installed, executed directly via `npm test`.
* **Tests**:
  * Unit test: `marked` parses markdown syntax correctly.
  * Endpoint test: `GET /health` returns status `200` and `"UP"`.
  * PDF test: `POST /api/convert` returns a non-empty buffer starting with `%PDF-`.

---

## 5. Local Setup & Run Commands

```bash
# 1. Navigate to app directory
cd SWE40006-Group3/CloudMarkDownConverter

# 2. Install dependencies
npm install

# 3. Run automated tests (what Jenkins will run)
npm test

# 4. Start the server locally
npm start
# Open http://localhost:3000 in browser
```
