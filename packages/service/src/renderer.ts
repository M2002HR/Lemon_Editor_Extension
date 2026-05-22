import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import puppeteer from 'puppeteer';
import type { PdfDensity, PdfDirection, PdfFontSize, PdfInputFormat, PdfRenderOptions } from './types.js';

const rtlScript = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const PAGE_BORDER_SAFE_PADDING_MM = 10;

interface ResolvedRenderOptions {
  direction: Exclude<PdfDirection, 'auto'>;
  pageNumbers: boolean;
  pageBorder: boolean;
  smartPagination: boolean;
  fontSize: PdfFontSize;
  density: PdfDensity;
  codeWrap: boolean;
}

interface FontEntry {
  file: string;
  family: string;
  format: string;
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(dirname, '..');
const fontDir = path.join(serviceRoot, 'assets/fonts');
const fontManifestPath = path.join(fontDir, 'fonts.manifest.json');
const fontEntries = loadFontEntries();
const fontLookup = new Map(fontEntries.map((entry) => [entry.family.toLowerCase(), entry]));
const fontDataUriCache = new Map<string, string>();

function buildHtml(
  content: string,
  title: string | undefined,
  options: ResolvedRenderOptions,
  inputFormat: PdfInputFormat,
  usedFontsCss: string
): string {
  const bodyContent = inputFormat === 'markdown' ? marked.parse(content) : content;
  const css = buildStylesheet(options, usedFontsCss);
  const dir = options.direction;

  return `<!doctype html>
<html lang="en" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title ?? 'Markdown PDF')}</title>
    <style>${css}</style>
  </head>
  <body>
    ${options.pageBorder ? '<div class="page-frame" aria-hidden="true"></div>' : ''}
    <main class="page-shell">${bodyContent}</main>
  </body>
</html>`;
}

function buildStylesheet(options: ResolvedRenderOptions, usedFontsCss: string): string {
  const fontSize = fontSizeValue(options.fontSize);
  const lineHeight = densityLineHeight(options.density);
  const paragraphGap = densityGap(options.density);

  const baseStyles = `
${usedFontsCss}
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Vazirmatn", "BNazanin", "BYekan", "Tahoma", "Segoe UI", sans-serif;
  color: #111827;
  line-height: ${lineHeight};
  font-size: ${fontSize};
  direction: ${options.direction};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page-shell {
  display: flow-root;
  padding: ${options.pageBorder ? `${PAGE_BORDER_SAFE_PADDING_MM}mm` : '0'};
  position: relative;
  z-index: 2;
}
.page-frame {
  position: fixed;
  inset: 0;
  border: 1.4px solid #cdd5e1;
  border-radius: 10px;
  pointer-events: none;
  z-index: 1;
}

.page-shell > :first-child {
  margin-top: 0 !important;
}
h1, h2, h3, h4, h5, h6 {
  color: #0f172a;
  line-height: 1.3;
  margin-top: 1.6em;
  margin-bottom: 0.55em;
}
p, ul, ol, pre, table, blockquote {
  margin: 0 0 ${paragraphGap};
}

h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th {
  overflow-wrap: anywhere;
  word-break: break-word;
}

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
  overflow: ${options.codeWrap ? 'visible' : 'auto'};
  white-space: ${options.codeWrap ? 'pre-wrap' : 'pre'};
  word-break: ${options.codeWrap ? 'break-word' : 'normal'};
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
a {
  color: #0f4c81;
  text-decoration: none;
}
img, svg, pre, blockquote, table {
  max-width: 100%;
}
table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  font-size: 0.95em;
}
th, td {
  border: 1px solid #d1d5db;
  padding: 8px;
  text-align: start;
  vertical-align: top;
}
`;

  const smartPaginationStyles = options.smartPagination
    ? `
@media print {
  h1, h2, h3, h4, h5, h6 {
    break-after: avoid-page;
    page-break-after: avoid;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  h1 + p,
  h2 + p,
  h3 + p,
  h4 + p,
  h5 + p,
  h6 + p,
  h1 + ul,
  h2 + ul,
  h3 + ul,
  h1 + ol,
  h2 + ol,
  h3 + ol {
    break-before: avoid-page;
    page-break-before: avoid;
  }

  p {
    orphans: 3;
    widows: 3;
  }

  pre, table, blockquote {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
}
`
    : '';

  return `${baseStyles}${smartPaginationStyles}`;
}

function resolveDirection(content: string, requestedDirection: PdfDirection): 'rtl' | 'ltr' {
  if (requestedDirection === 'rtl' || requestedDirection === 'ltr') {
    return requestedDirection;
  }

  return rtlScript.test(content) ? 'rtl' : 'ltr';
}

function fontSizeValue(size: PdfFontSize): string {
  if (size === 'small') return '14px';
  if (size === 'large') return '16px';
  return '15px';
}

function densityLineHeight(density: PdfDensity): string {
  if (density === 'compact') return '1.52';
  if (density === 'relaxed') return '1.78';
  return '1.65';
}

function densityGap(density: PdfDensity): string {
  if (density === 'compact') return '0.75em';
  if (density === 'relaxed') return '1.2em';
  return '1em';
}

function buildFooterTemplate(direction: 'rtl' | 'ltr'): string {
  const align = direction === 'rtl' ? 'left' : 'right';

  return `
<div style="
  width: 100%;
  padding: 0 14mm;
  font-size: 9px;
  color: #6b7280;
  text-align: ${align};
  direction: ${direction};
  font-family: Tahoma, Segoe UI, sans-serif;
">
  <span class="pageNumber"></span>/<span class="totalPages"></span>
</div>`;
}

export async function renderMarkdownToPdf(
  content: string,
  title: string | undefined,
  options: PdfRenderOptions,
  inputFormat: PdfInputFormat = 'markdown'
): Promise<Buffer> {
  const resolvedOptions: ResolvedRenderOptions = {
    ...options,
    direction: resolveDirection(content, options.direction)
  };

  const usedFontsCss = buildUsedFontsCss(content);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(content, title, resolvedOptions, inputFormat, usedFontsCss), {
      waitUntil: 'domcontentloaded'
    });
    await page.emulateMediaType('print');
    await page.evaluate(async () => {
      const doc = (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } }).document;
      if (doc?.fonts?.ready) {
        await doc.fonts.ready;
      }
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: resolvedOptions.pageNumbers,
      headerTemplate: '<div></div>',
      footerTemplate: resolvedOptions.pageNumbers ? buildFooterTemplate(resolvedOptions.direction) : '<div></div>',
      margin: {
        top: resolvedOptions.pageNumbers ? '16mm' : '14mm',
        right: '14mm',
        bottom: resolvedOptions.pageNumbers ? '18mm' : '14mm',
        left: '14mm'
      }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function buildUsedFontsCss(content: string): string {
  if (fontEntries.length === 0) {
    return '';
  }

  const families = extractFontFamiliesFromContent(content);
  if (families.size === 0) {
    return '';
  }

  const faceBlocks: string[] = [];

  for (const family of families) {
    const entry = fontLookup.get(family.toLowerCase());
    if (!entry) {
      continue;
    }

    const dataUri = fontToDataUri(entry);
    faceBlocks.push(`@font-face{font-family:"${escapeCss(entry.family)}";src:url("${dataUri}") format("${entry.format}");font-display:swap;}`);
  }

  return faceBlocks.join('\n');
}

function extractFontFamiliesFromContent(content: string): Set<string> {
  const families = new Set<string>();

  const styleRegex = /font-family\s*:\s*([^;"']+|"[^"]+"|'[^']+')/gi;
  for (const match of content.matchAll(styleRegex)) {
    const raw = match[1];
    if (!raw) continue;

    for (const part of raw.split(',')) {
      const name = normalizeFamilyName(part);
      if (name) {
        families.add(name);
      }
    }
  }

  const faceRegex = /<font[^>]*face=["']([^"']+)["']/gi;
  for (const match of content.matchAll(faceRegex)) {
    const raw = match[1];
    if (!raw) continue;
    const name = normalizeFamilyName(raw);
    if (name) {
      families.add(name);
    }
  }

  return families;
}

function normalizeFamilyName(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function fontToDataUri(entry: FontEntry): string {
  const cached = fontDataUriCache.get(entry.file);
  if (cached) {
    return cached;
  }

  const filePath = path.join(fontDir, entry.file);
  const bytes = readFileSync(filePath);
  const mime = fontMimeFromFormat(entry.format);
  const dataUri = `data:${mime};base64,${bytes.toString('base64')}`;
  fontDataUriCache.set(entry.file, dataUri);
  return dataUri;
}

function fontMimeFromFormat(format: string): string {
  if (format === 'woff2') return 'font/woff2';
  if (format === 'woff') return 'font/woff';
  if (format === 'opentype') return 'font/otf';
  return 'font/ttf';
}

function loadFontEntries(): FontEntry[] {
  try {
    if (existsSync(fontManifestPath)) {
      const raw = readFileSync(fontManifestPath, 'utf8');
      const parsed = JSON.parse(raw) as Array<{ file?: string; family?: string; format?: string }>;
      return parsed
        .filter((item) => Boolean(item.file && item.family && item.format))
        .map((item) => ({
          file: item.file as string,
          family: item.family as string,
          format: item.format as string
        }));
    }
  } catch {
    return [];
  }

  return [];
}

function escapeCss(value: string): string {
  return value.replaceAll('"', '\\"');
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
