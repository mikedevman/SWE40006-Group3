const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const pkg = require('./package.json');
const { getTemplates, convertMarkdownToPdf } = require('./converter');

const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/** Sanitize a document title for use in a Content-Disposition PDF filename. */
function buildPdfFilename(title) {
  if (typeof title !== 'string' || !title.trim()) {
    return 'document.pdf';
  }
  const safe = title
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!safe) return 'document.pdf';
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'Content-Disposition'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        const err = new Error('Payload exceeds 2 MB limit.');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        const err = new Error('Invalid JSON request body.');
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(FRONTEND_DIR, relPath);
  if (!resolved.startsWith(FRONTEND_DIR + path.sep) && resolved !== FRONTEND_DIR) {
    return sendJson(res, 403, { error: 'Forbidden.' });
  }

  let filePath = resolved;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': data.length
  });
  return res.end(req.method === 'HEAD' ? undefined : data);
}

/** Handle incoming HTTP requests for API routes and static frontend assets. */
async function handleRequest(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { status: 'UP', version: pkg.version });
  }

  if (req.method === 'GET' && pathname === '/api/templates') {
    return sendJson(res, 200, getTemplates());
  }

  if (req.method === 'POST' && pathname === '/api/convert') {
    try {
      const body = await readJsonBody(req);
      const payload = body && typeof body === 'object' ? body : {};
      const { markdown, template, size, orient, margin, font, title } = payload;

      if (typeof markdown !== 'string' || !markdown.trim()) {
        return sendJson(res, 400, { error: 'Markdown content is required.' });
      }

      const pdfBuffer = await convertMarkdownToPdf({
        markdown,
        template,
        size,
        orient,
        margin,
        font,
        title
      });
      const filename = buildPdfFilename(title);
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length
      });
      return res.end(pdfBuffer);
    } catch (err) {
      if (err instanceof RangeError) {
        return sendJson(res, 400, { error: err.message });
      }
      if (err && err.statusCode) {
        return sendJson(res, err.statusCode, { error: err.message });
      }
      console.error('Unhandled backend error:', err);
      return sendJson(res, 500, { error: 'Failed to process request.' });
    }
  }

  if (pathname.startsWith('/api/') || pathname === '/api') {
    return sendJson(res, 404, { error: 'API endpoint not found.' });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, pathname);
  }

  return sendJson(res, 405, { error: 'Method not allowed.' });
}

/** Create the stateless Node HTTP server instance. */
function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const server = createServer();
  server.listen(port, () => {
    console.log(`MarkFlow server listening on http://localhost:${port}`);
  });
}

module.exports = { createServer, buildPdfFilename };
