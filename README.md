# Markdown to PDF Monorepo

This repository contains:

- `@mdpdf/service`: a local Express API that converts Markdown/HTML to PDF.
- `@mdpdf/extension`: a Chrome MV3 extension that adds an export button next to ChatGPT assistant responses.

## Major Features

- Modern in-page `Export PDF` button
- Export settings popup (direction, font size, density, page numbers, page border, smart pagination)
- Full-screen advanced editor before export
- RTL/LTR handling (auto + manual)
- Per-line direction controls in editor (RTL line / LTR line)
- Font selection from bundled Persian font set
- HTML-mode export from editor so downloaded PDF matches edited content

## Requirements

- Node.js 20+
- npm 10+
- Google Chrome (or Chromium-based browser)

## Configuration (`.env`)

All configurable values are in root `.env` and `.env.example`.

```bash
cp .env.example .env
```

Variables:

- `SERVICE_PORT`
- `SERVICE_MAX_MARKDOWN_LENGTH`
- `SERVICE_JSON_BODY_LIMIT`
- `SERVICE_DEFAULT_FILENAME_BASE`
- `SERVICE_ALLOW_CHROME_EXTENSION_ORIGINS`
- `SERVICE_ALLOWED_ORIGINS`
- `EXTENSION_API_BASE_URL` (build-time)
- `EXTENSION_FILENAME_PREFIX` (build-time)

## Install

```bash
npm install
```

## Dev / Build / Test

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run typecheck
```

## Service API

### `GET /health`

### `POST /api/v1/markdown-to-pdf`

```json
{
  "markdown": "# Hello",
  "html": "<h1>Hello</h1>",
  "title": "Optional title",
  "filename": "output.pdf",
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

- If `html` is present, service renders HTML mode.
- Otherwise `markdown` is required.

## Load Extension in Chrome

1. `npm run build:extension`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select `packages/extension/dist`
5. Open `https://chatgpt.com`

## Manual Smoke Test

1. Start service: `npm run dev:service`
2. Build extension: `npm run build:extension`
3. Reload extension in `chrome://extensions`
4. On ChatGPT response click `Export PDF`
5. Change settings and export directly
6. Open **Full Editor**, edit content/font/directions, then **Download PDF**
7. Verify PDF output matches edited content
