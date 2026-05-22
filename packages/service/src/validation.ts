import { MAX_MARKDOWN_LENGTH } from './constants.js';
import type { MarkdownToPdfRequestBody, ValidatedPayload } from './types.js';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const FALLBACK_FILENAME = 'chatgpt-answer.pdf';

export function validateRequestBody(body: MarkdownToPdfRequestBody): ValidatedPayload {
  if (typeof body.markdown !== 'string') {
    throw new HttpError(400, 'Field "markdown" must be a string.');
  }

  const markdown = body.markdown.trim();
  if (!markdown) {
    throw new HttpError(400, 'Field "markdown" cannot be empty.');
  }

  if (markdown.length > MAX_MARKDOWN_LENGTH) {
    throw new HttpError(413, `Field "markdown" cannot exceed ${MAX_MARKDOWN_LENGTH} characters.`);
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : undefined;
  const requestedFilename = typeof body.filename === 'string' ? body.filename : FALLBACK_FILENAME;
  const filename = sanitizeFilename(requestedFilename);

  return { markdown, title: title || undefined, filename };
}

function sanitizeFilename(input: string): string {
  const trimmed = input.trim();
  const safeBase = trimmed
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  const finalBase = safeBase || 'chatgpt-answer';
  return `${finalBase}.pdf`;
}
