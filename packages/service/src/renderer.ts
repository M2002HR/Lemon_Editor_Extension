import { marked } from 'marked';
import puppeteer from 'puppeteer';

const stylesheet = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: #111827;
  line-height: 1.65;
  margin: 0;
  font-size: 15px;
}
h1, h2, h3, h4, h5, h6 {
  color: #0f172a;
  line-height: 1.3;
  margin-top: 1.6em;
  margin-bottom: 0.6em;
}
p, ul, ol, pre, table, blockquote { margin: 0 0 1em; }
ul, ol { padding-inline-start: 1.4em; }
code {
  background: #f3f4f6;
  border-radius: 4px;
  padding: 0.1em 0.3em;
  font-family: "Cascadia Code", "Fira Code", monospace;
  font-size: 0.9em;
}
pre {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  overflow: auto;
}
pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}
blockquote {
  border-inline-start: 4px solid #cbd5e1;
  margin-inline-start: 0;
  padding-inline: 12px;
  color: #334155;
}
a { color: #1d4ed8; text-decoration: none; }
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.95em;
}
th, td {
  border: 1px solid #d1d5db;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}
`;

function buildHtml(markdown: string, title?: string): string {
  const content = marked.parse(markdown);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title ?? 'Markdown PDF')}</title>
    <style>${stylesheet}</style>
  </head>
  <body>
    ${content}
  </body>
</html>`;
}

export async function renderMarkdownToPdf(markdown: string, title?: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(markdown, title), { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '18mm',
        right: '14mm',
        bottom: '18mm',
        left: '14mm'
      }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
