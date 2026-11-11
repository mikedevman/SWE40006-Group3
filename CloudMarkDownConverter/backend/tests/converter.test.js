const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer, buildPdfFilename } = require('../server');
const {
  resolveTemplateId,
  normalizeOptions,
  renderMarkdownToHtml,
  buildTemplateHtml,
  buildFallbackPdf
} = require('../converter');

describe('Markdown parsing and template rendering', () => {
  it('parses standard Markdown syntax and tables into HTML', () => {
    const html = renderMarkdownToHtml(
      '# Hello\n\nThis is **bold** and *italic*.\n\n- One\n- Two\n\n| Col A | Col B |\n| --- | --- |\n| Val 1 | Val 2 |'
    );
    assert.match(html, /<h1>Hello<\/h1>/);
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /<em>italic<\/em>/);
    assert.match(html, /<ul>/);
    assert.match(html, /<li>One<\/li>/);
    assert.match(html, /<table><thead><tr><th>Col A<\/th><th>Col B<\/th><\/tr><\/thead><tbody><tr><td>Val 1<\/td><td>Val 2<\/td><\/tr><\/tbody><\/table>/);
  });

  it('escapes raw HTML tags and neutralizes unsafe link schemes', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script>\n\n[Click](javascript:alert(1))');
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /href="javascript:/);
  });

  it('resolves valid templates, defaults, and aliases', () => {
    assert.equal(resolveTemplateId(undefined), 'minimal');
    assert.equal(resolveTemplateId('default'), 'minimal');
    assert.equal(resolveTemplateId('report'), 'business');
    assert.equal(resolveTemplateId('resume'), 'resume');
    assert.equal(resolveTemplateId('nonexistent'), null);
  });

  it('builds print-ready template HTML for all five templates and page options', () => {
    for (const tplId of ['minimal', 'academic', 'business', 'resume', 'tech']) {
      const html = buildTemplateHtml({
        markdown: '# Report <Q4>',
        title: 'Q4 <Summary>',
        template: tplId,
        size: 'Letter',
        orient: 'landscape',
        margin: 'narrow',
        font: 'mono'
      });
      assert.match(html, /<title>Q4 &lt;Summary&gt;<\/title>/);
      assert.match(html, /size:\s*Letter landscape;/);
      assert.match(html, /margin:\s*48px;/);
      assert.match(html, /ui-monospace, Consolas, monospace/);
      assert.match(html, /<h1>Report &lt;Q4&gt;<\/h1>/);
    }
  });

  it('preserves literal placeholder tokens inside markdown and builds fallback PDF', () => {
    const html = buildTemplateHtml({
      markdown: 'Keep literal {{TITLE}} and {{BODY}} intact.',
      title: 'Token Check',
      template: 'minimal'
    });
    assert.match(html, /Keep literal \{\{TITLE\}\} and \{\{BODY\}\} intact\./);

    const pdfRaw = buildFallbackPdf('# Fallback Title\n\n- Line one\n- Line two', {
      template: 'resume',
      size: 'A4',
      orient: 'portrait',
      margin: 'normal'
    });
    assert.ok(Buffer.isBuffer(pdfRaw));
    assert.equal(pdfRaw.subarray(0, 5).toString('ascii'), '%PDF-');

    const pdfNormalized = buildFallbackPdf(
      'Multi line fallback content\nSecond line',
      normalizeOptions({ template: 'minimal', size: 'Letter', orient: 'landscape', margin: 'wide' })
    );
    assert.ok(Buffer.isBuffer(pdfNormalized));
    assert.equal(pdfNormalized.subarray(0, 5).toString('ascii'), '%PDF-');
  });

  it('sanitizes Content-Disposition PDF filenames', () => {
    assert.equal(buildPdfFilename(), 'document.pdf');
    assert.equal(buildPdfFilename('Q4 Product Report'), 'Q4-Product-Report.pdf');
    assert.equal(buildPdfFilename('notes.pdf'), 'notes.pdf');
    assert.equal(buildPdfFilename('   '), 'document.pdf');
    assert.equal(buildPdfFilename('文档'), 'document.pdf');
  });
});

describe('POST /api/convert endpoint', () => {
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

  it('returns 400 when markdown is missing or blank', async () => {
    const res = await fetch(`${baseUrl}/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '   ', template: 'minimal' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Markdown content is required/i);
  });

  it('returns 400 when template or page options are invalid', async () => {
    const res = await fetch(`${baseUrl}/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '# Test', template: 'unknown-tpl' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Unknown template/i);
  });

  it('returns a valid PDF buffer starting with %PDF- across all templates', async () => {
    for (const template of ['minimal', 'academic', 'business', 'resume', 'tech']) {
      const res = await fetch(`${baseUrl}/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: `# ${template} Title\n\n| Item | Value |\n| --- | --- |\n| Status | OK |`,
          title: `Report ${template}`,
          template
        })
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'application/pdf');
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
      assert.match(res.headers.get('access-control-expose-headers') || '', /Content-Disposition/i);
      assert.equal(
        res.headers.get('content-disposition'),
        `attachment; filename="Report-${template}.pdf"`
      );

      const arrayBuffer = await res.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      assert.ok(pdfBuffer.length > 0);
      assert.equal(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
    }
  });
});

