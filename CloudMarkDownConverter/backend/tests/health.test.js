const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

describe('Health and template API endpoints', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = createServer();
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /health returns 200 and UP status with CORS headers', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const body = await res.json();
    assert.deepEqual(body, { status: 'UP', version: '1.0.0' });
  });

  it('OPTIONS /api/convert returns 204 preflight CORS headers', async () => {
    const res = await fetch(`${baseUrl}/api/convert`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.match(res.headers.get('access-control-allow-methods') || '', /POST/);
    assert.match(res.headers.get('access-control-expose-headers') || '', /Content-Disposition/i);
  });

  it('GET /api/templates returns the five styling templates', async () => {
    const res = await fetch(`${baseUrl}/api/templates`);
    assert.equal(res.status, 200);
    const templates = await res.json();
    assert.equal(Array.isArray(templates), true);
    assert.deepEqual(
      templates.map((t) => t.id),
      ['minimal', 'academic', 'business', 'resume', 'tech']
    );
    for (const tpl of templates) {
      assert.equal(typeof tpl.name, 'string');
      assert.equal(typeof tpl.description, 'string');
    }
  });

  it('GET / serves the frontend index.html page', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    const html = await res.text();
    assert.match(html, /MarkFlow/);
  });

  it('serves all frontend pages and shared script', async () => {
    for (const file of [
      '/index.html',
      '/workspace.html',
      '/templates.html',
      '/export.html',
      '/documents.html',
      '/settings.html',
      '/markflow.js'
    ]) {
      const res = await fetch(`${baseUrl}${file}`);
      assert.equal(res.status, 200, `${file} should return 200`);
    }
  });

  it('GET /api/unknown returns 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(typeof body.error, 'string');
  });
});

