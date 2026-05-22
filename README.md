# Markdown to PDF Monorepo

This repository contains:

- `@mdpdf/service`: a local Express API that converts Markdown to PDF.
- `@mdpdf/extension`: a Chrome MV3 extension that adds a PDF export button next to ChatGPT assistant responses.

## Requirements

- Node.js 20+
- npm 10+
- Google Chrome (or Chromium-based browser)

## Install

```bash
npm install
```

## Development

Run service and extension watcher together:

```bash
npm run dev
```

This starts:

- service on `http://localhost:4000`
- extension bundle watcher writing to `packages/extension/dist`

## Build

```bash
npm run build
```

## Test

```bash
npm run test
```

## Quality checks

```bash
npm run lint
npm run typecheck
```

## Service API

### Health check

```http
GET /health
```

### Markdown to PDF

```http
POST /api/v1/markdown-to-pdf
Content-Type: application/json

{
  "markdown": "# Hello\\n\\nThis is markdown",
  "title": "Optional title",
  "filename": "optional-filename.pdf"
}
```

Response: `application/pdf`

## Load the extension in Chrome

1. Build extension: `npm run build:extension`
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select `packages/extension/dist`

## Manual smoke test

1. Start service: `npm run dev:service`
2. Build or watch extension: `npm run dev:extension`
3. Load unpacked extension from `packages/extension/dist`
4. Open `https://chatgpt.com/`
5. Confirm each assistant response has a `PDF` button
6. Click `PDF` and verify a `.pdf` file is downloaded
7. Stop service and click `PDF` again; verify an error message is shown in the response area

## Git workflow used

Atomic commits used in this order:

1. `chore(repo): init npm workspaces + shared tooling`
2. `feat(service): add markdown-to-pdf API`
3. `test(service): add health and conversion integration tests`
4. `feat(extension): inject PDF button and wire background flow`
5. `test(extension): add unit tests for parser/injection logic`
6. `docs: add run/build/test/load-unpacked instructions`
