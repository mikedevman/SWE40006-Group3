const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const TEMPLATES_DIR = path.join(__dirname, 'templates');

const TEMPLATES = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean sans-serif with generous white space.',
    bf: 'Inter',
    hf: 'Inter',
    ac: '#0B0F1A',
    hb: '0',
    sz: '11pt',
    m: 72
  },
  academic: {
    id: 'academic',
    name: 'Academic Report',
    description: 'Serif text with a thin rule under the title.',
    bf: 'Newsreader',
    hf: 'Newsreader',
    ac: '#1B2233',
    hb: '1px solid #1B2233',
    sz: '12pt',
    m: 72
  },
  business: {
    id: 'business',
    name: 'Business Report',
    description: 'Bold headings and a cornflower title rule.',
    bf: 'Inter',
    hf: 'Inter',
    ac: '#3F73E6',
    hb: '4px solid #548CFF',
    sz: '10.5pt',
    m: 72
  },
  resume: {
    id: 'resume',
    name: 'Resume / CV',
    description: 'Compact layout that fits a career on one page.',
    bf: 'Inter',
    hf: 'Inter',
    ac: '#0B0F1A',
    hb: '0',
    sz: '9.5pt',
    m: 52
  },
  tech: {
    id: 'tech',
    name: 'Technical Documentation',
    description: 'Monospace headings, built around code and notes.',
    bf: 'Inter',
    hf: 'ui-monospace, Consolas, monospace',
    ac: '#0B0F1A',
    hb: '1px solid #D5DBE5',
    sz: '10.5pt',
    m: 72
  }
};

const TEMPLATE_ALIASES = {
  default: 'minimal',
  report: 'business'
};

const PAGE_SIZES = {
  a4: { label: 'A4', pt: [595.28, 841.89] },
  letter: { label: 'Letter', pt: [612, 792] },
  legal: { label: 'Legal', pt: [612, 1008] }
};

const ORIENTATIONS = new Set(['portrait', 'landscape']);
const MARGINS = { narrow: 48, normal: null, wide: 96 };
const FONTS = {
  '': null,
  Inter: 'Inter',
  Newsreader: 'Newsreader',
  mono: 'ui-monospace, Consolas, monospace'
};

const templateCache = new Map();

/** Escape special HTML characters to prevent markup injection. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Allow only http(s), mailto, or in-page hash URLs in Markdown links and images. */
function isSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('#')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/** Render inline Markdown formatting safely while preserving inline code spans. */
function renderInline(raw) {
  const codeTokens = [];
  const withPlaceholders = String(raw).replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });

  let html = escapeHtml(withPlaceholders);

  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => (
    isSafeUrl(url) ? `<img src="${url}" alt="${alt}">` : alt
  ));
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => (
    isSafeUrl(url) ? `<a href="${url}">${label}</a>` : label
  ));
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');

  return html.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codeTokens[Number(i)]);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  if (!line || !line.includes('|')) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

const LIST_ITEM_RE = /^\s*([-*]|\d+\.)\s+/;
const BLOCK_START_RE = /^(#{1,6}\s|```|>|\s*(-{3,}|\*{3,}|_{3,})\s*$|\s*([-*]|\d+\.)\s)/;

/** Convert raw Markdown text into sanitized HTML without external dependencies. */
function renderMarkdownToHtml(markdown) {
  if (typeof markdown !== 'string') {
    throw new TypeError('Markdown input must be a string.');
  }

  const lines = markdown.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i++]);
      }
      if (i < lines.length) i++;
      out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitTableRow(lines[i++]));
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = rows.length
        ? `<tbody>${rows.map((r) => `<tr>${headers.map((_, c) => `<td>${renderInline(r[c] || '')}</td>`).join('')}</tr>`).join('')}</tbody>`
        : '';
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i++].replace(/^>\s?/, ''));
      }
      out.push(`<blockquote><p>${renderInline(quoteLines.join(' '))}</p></blockquote>`);
      continue;
    }

    if (LIST_ITEM_RE.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && LIST_ITEM_RE.test(lines[i])) {
        items.push(lines[i++].replace(LIST_ITEM_RE, ''));
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`);
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !BLOCK_START_RE.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i++]);
    }
    if (!para.length) para.push(lines[i++]);
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

/** Return the list of available PDF styling templates. */
function getTemplates() {
  return Object.values(TEMPLATES).map((tpl) => ({ ...tpl }));
}

/** Resolve a template identifier (including aliases) or return null if invalid. */
function resolveTemplateId(templateId) {
  if (templateId === undefined || templateId === null || templateId === '') {
    return 'minimal';
  }
  const key = String(templateId).trim().toLowerCase();
  const normalized = TEMPLATE_ALIASES[key] || key;
  return Object.hasOwn(TEMPLATES, normalized) ? normalized : null;
}

function loadTemplateFile(templateId) {
  if (!templateCache.has(templateId)) {
    const filePath = path.join(TEMPLATES_DIR, `${templateId}.html`);
    templateCache.set(templateId, fs.readFileSync(filePath, 'utf8'));
  }
  return templateCache.get(templateId);
}

/** Validate and normalize PDF conversion options. */
function normalizeOptions(options = {}) {
  const templateId = resolveTemplateId(options.template);
  if (!templateId) {
    throw new RangeError(`Unknown template: ${options.template}`);
  }

  const rawSize = String(options.size || 'A4').trim().toLowerCase();
  const sizeSpec = PAGE_SIZES[rawSize];
  if (!sizeSpec) {
    throw new RangeError(`Unsupported paper size: ${options.size}`);
  }

  const orient = String(options.orient || 'portrait').trim().toLowerCase();
  if (!ORIENTATIONS.has(orient)) {
    throw new RangeError(`Unsupported orientation: ${options.orient}`);
  }

  const marginKey = String(options.margin || 'normal').trim().toLowerCase();
  if (!Object.hasOwn(MARGINS, marginKey)) {
    throw new RangeError(`Unsupported margin preset: ${options.margin}`);
  }

  const fontKey = options.font === undefined || options.font === null ? '' : String(options.font).trim();
  if (!Object.hasOwn(FONTS, fontKey)) {
    throw new RangeError(`Unsupported font option: ${options.font}`);
  }

  const title = typeof options.title === 'string' && options.title.trim()
    ? options.title.trim()
    : 'Document';

  return { templateId, size: sizeSpec.label, sizePt: sizeSpec.pt, orient, marginKey, fontKey, title };
}

/** Build a complete print-ready HTML document for a template and Markdown payload. */
function buildTemplateHtml(options) {
  const { markdown } = options;
  if (typeof markdown !== 'string' || !markdown.trim()) {
    throw new RangeError('Markdown content is required.');
  }

  const { templateId, size, orient, marginKey, fontKey, title } = normalizeOptions(options);
  const tpl = TEMPLATES[templateId];
  const marginPx = MARGINS[marginKey] ?? tpl.m ?? 72;
  const bodyFont = FONTS[fontKey] || tpl.bf;
  const contentHtml = renderMarkdownToHtml(markdown);

  const replacements = {
    '{{TITLE}}': escapeHtml(title),
    '{{PAGE_SIZE}}': `${size} ${orient}`,
    '{{BODY_FONT}}': bodyFont,
    '{{HEADING_FONT}}': tpl.hf,
    '{{ACCENT_COLOR}}': tpl.ac,
    '{{HEADING_BORDER}}': tpl.hb,
    '{{FONT_SIZE}}': tpl.sz,
    '{{MARGIN}}': `${marginPx}px`,
    '{{CONTENT}}': contentHtml
  };

  let html = loadTemplateFile(templateId);
  html = html.replace(
    '<head>',
    '<head>\n<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\';">'
  );
  return html.replace(
    /\{\{(TITLE|PAGE_SIZE|BODY_FONT|HEADING_FONT|ACCENT_COLOR|HEADING_BORDER|FONT_SIZE|MARGIN|CONTENT)\}\}/g,
    (_, key) => replacements[`{{${key}}}`]
  );
}

/** Locate an installed system Chrome, Edge, or Chromium binary for headless PDF printing. */
function findBrowserBinary() {
  const envPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ]
      : [
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/google-chrome',
          '/usr/bin/microsoft-edge'
        ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function runBrowserPrint(browserPath, htmlPath, pdfPath, profileDir) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-pdf-header-footer',
      `--user-data-dir=${profileDir}`,
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href
    ];

    execFile(browserPath, args, { timeout: 25000, windowsHide: true }, (err) => {
      if (err) return reject(err);
      if (!fs.existsSync(pdfPath)) {
        return reject(new Error('Browser completed without creating PDF output.'));
      }
      return resolve(fs.readFileSync(pdfPath));
    });
  });
}

function escapePdfText(text) {
  return String(text)
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/** Generate a minimal valid PDF 1.4 buffer when no headless browser binary is installed. */
function buildFallbackPdf(markdown, options = {}) {
  const normalized = options && Array.isArray(options.sizePt) ? options : normalizeOptions(options || {});
  const [baseW, baseH] = normalized.sizePt;
  const width = normalized.orient === 'landscape' ? baseH : baseW;
  const height = normalized.orient === 'landscape' ? baseW : baseH;
  const tpl = TEMPLATES[normalized.templateId] || TEMPLATES.minimal;
  const margin = (MARGINS[normalized.marginKey] ?? tpl.m ?? 72) * 0.75;
  const lineHeight = 15;
  const maxChars = Math.max(30, Math.floor((width - margin * 2) / 6.2));

  const wrappedLines = [];
  for (const rawLine of String(markdown).replace(/\r/g, '').split('\n')) {
    const clean = rawLine.replace(/^#{1,6}\s+/, '').trimEnd();
    if (!clean) {
      wrappedLines.push('');
      continue;
    }
    for (let pos = 0; pos < clean.length; pos += maxChars) {
      wrappedLines.push(clean.slice(pos, pos + maxChars));
    }
  }

  const linesPerPage = Math.max(10, Math.floor((height - margin * 2) / lineHeight));
  const pages = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push(['']);

  const objects = [];
  const pageIds = [];
  const fontId = 3;

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push(''); // Placeholder for Pages object 2
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  let nextId = 4;
  for (const pageLines of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);

    const streamOps = ['BT', '/F1 11 Tf', `${margin.toFixed(2)} ${(height - margin).toFixed(2)} Td`, `${lineHeight} TL`];
    for (const line of pageLines) {
      streamOps.push(`(${escapePdfText(line)}) Tj T*`);
    }
    streamOps.push('ET');
    const stream = streamOps.join('\n');

    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream\nendobj`
    );
  }

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${obj}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

/** Convert Markdown and template options into a PDF Buffer. */
async function convertMarkdownToPdf(options) {
  const normalized = normalizeOptions(options);
  const html = buildTemplateHtml(options);
  const browserPath = findBrowserBinary();

  if (browserPath) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-'));
    try {
      const htmlPath = path.join(workDir, 'document.html');
      const pdfPath = path.join(workDir, 'document.pdf');
      const profileDir = path.join(workDir, 'profile');
      fs.writeFileSync(htmlPath, html, 'utf8');
      return await runBrowserPrint(browserPath, htmlPath, pdfPath, profileDir);
    } catch {
      // Fall back to pure-JS PDF output if the local browser refuses headless printing.
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      } catch {
        // Ignore transient Windows file lock on temp profile cleanup.
      }
    }
  }

  return buildFallbackPdf(options.markdown, normalized);
}

module.exports = {
  TEMPLATES,
  getTemplates,
  resolveTemplateId,
  normalizeOptions,
  renderMarkdownToHtml,
  buildTemplateHtml,
  buildFallbackPdf,
  convertMarkdownToPdf
};
