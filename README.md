# Lemon Editor Extension

**A Chrome MV3 extension and local TypeScript service for turning ChatGPT responses into polished, editable PDFs.**

Lemon adds an export workflow directly to ChatGPT, opens a full-screen editor for final adjustments, and generates PDFs with configurable typography, pagination, borders, density, and mixed RTL/LTR content.

## Engineering highlights

- Chrome Manifest V3 extension with content-script UI injection
- Full-screen editor for editing generated content before export
- Mixed Persian/English RTL and LTR support, including per-line direction controls
- Local Express API for Markdown/HTML-to-PDF rendering
- TypeScript monorepo with shared development scripts
- Configurable page layout, font size, density, borders, page numbers, and pagination
- Build, test, lint, and type-check workflows
- Separation between browser UX and document-rendering service

## Technology

`TypeScript` · `Chrome Extension MV3` · `Node.js` · `Express` · `HTML/CSS` · `Markdown` · `PDF generation` · `npm workspaces`

## Architecture

```text
ChatGPT page
  │
  ▼
Chrome MV3 extension
  ├── injects Export PDF action
  ├── collects response content
  ├── opens export settings
  └── launches advanced editor
        │
        ▼
Local Express service
  ├── validates Markdown / HTML
  ├── applies layout options
  └── renders final PDF
```

## Main features

- In-page **Export PDF** action
- Direct export or advanced editing workflow
- Font selection from a bundled Persian font set
- Automatic or manual document direction
- Per-line RTL/LTR controls
- Smart pagination and optional page borders
- Configurable page numbers, density, and font size
- HTML-mode export so the PDF matches edited content

## Repository structure

```text
packages/
  extension/   # Chrome MV3 extension
  service/     # Express PDF-generation API
package.json   # workspace scripts
.env.example   # service and extension configuration
```

## Requirements

- Node.js 20+
- npm 10+
- Google Chrome or another Chromium-based browser

## Install

```bash
npm install
cp .env.example .env
```

## Development

```bash
npm run dev
```

Quality checks:

```bash
npm run build
npm run test
npm run lint
npm run typecheck
```

## Load the extension

1. Build the extension:

   ```bash
   npm run build:extension
   ```

2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `packages/extension/dist`.
6. Open ChatGPT and use the injected export action.

## Service API

### Health check

```http
GET /health
```

### Generate PDF

```http
POST /api/v1/markdown-to-pdf
```

Example payload:

```json
{
  "markdown": "# Hello",
  "title": "Example document",
  "filename": "example.pdf",
  "options": {
    "direction": "auto",
    "pageNumbers": true,
    "pageBorder": true,
    "smartPagination": true,
    "fontSize": "medium",
    "density": "normal",
    "codeWrap": false
  }
}
```

When `html` is supplied, the service renders the edited HTML directly. Otherwise, `markdown` is required.

## Configuration

The root `.env` controls both services. Important variables include:

- `SERVICE_PORT`
- `SERVICE_MAX_MARKDOWN_LENGTH`
- `SERVICE_JSON_BODY_LIMIT`
- `SERVICE_ALLOWED_ORIGINS`
- `SERVICE_ALLOW_CHROME_EXTENSION_ORIGINS`
- `EXTENSION_API_BASE_URL`
- `EXTENSION_FILENAME_PREFIX`

## Manual smoke test

1. Start the service with `npm run dev:service`.
2. Build and reload the extension.
3. Open a ChatGPT response and select **Export PDF**.
4. Change layout settings and export directly.
5. Repeat with **Full Editor**.
6. Edit text, font, and direction settings.
7. Confirm the final PDF matches the edited document.

## Security and privacy

Lemon is designed around a local rendering service. Before exposing that service beyond localhost:

- restrict allowed origins
- set request size limits
- validate HTML and filenames
- place the API behind authentication
- avoid logging private document content

## Project status

Lemon demonstrates browser-extension engineering, TypeScript monorepo organization, full-stack API integration, document rendering, and multilingual UI design.