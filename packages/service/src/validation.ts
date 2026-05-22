import { DEFAULT_FILENAME_BASE, MAX_MARKDOWN_LENGTH } from './constants.js';
import type {
  MarkdownToPdfRequestBody,
  PdfDensity,
  PdfDirection,
  PdfFontSize,
  PdfRenderOptions,
  ValidatedPayload
} from './types.js';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const FALLBACK_FILENAME = `${DEFAULT_FILENAME_BASE}.pdf`;

const DEFAULT_OPTIONS: PdfRenderOptions = {
  direction: 'auto',
  pageNumbers: false,
  pageBorder: false,
  smartPagination: true,
  fontSize: 'medium',
  density: 'normal',
  codeWrap: false
};

const allowedDirections = new Set<PdfDirection>(['auto', 'rtl', 'ltr']);
const allowedFontSizes = new Set<PdfFontSize>(['small', 'medium', 'large']);
const allowedDensities = new Set<PdfDensity>(['compact', 'normal', 'relaxed']);

export function validateRequestBody(body: MarkdownToPdfRequestBody): ValidatedPayload {
  const payload = resolveContent(body);

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : undefined;
  const requestedFilename = typeof body.filename === 'string' ? body.filename : FALLBACK_FILENAME;
  const filename = sanitizeFilename(requestedFilename);
  const options = validateOptions(body.options);

  return {
    inputFormat: payload.inputFormat,
    content: payload.content,
    title: title || undefined,
    filename,
    options
  };
}

function resolveContent(body: MarkdownToPdfRequestBody): Pick<ValidatedPayload, 'inputFormat' | 'content'> {
  if (typeof body.html === 'string') {
    const content = body.html.trim();
    if (!content) {
      throw new HttpError(400, 'Field "html" cannot be empty.');
    }

    if (content.length > MAX_MARKDOWN_LENGTH * 4) {
      throw new HttpError(413, `Field "html" cannot exceed ${MAX_MARKDOWN_LENGTH * 4} characters.`);
    }

    return { inputFormat: 'html', content };
  }

  if (typeof body.markdown !== 'string') {
    throw new HttpError(400, 'Field "markdown" must be a string when "html" is not provided.');
  }

  const markdown = body.markdown.trim();
  if (!markdown) {
    throw new HttpError(400, 'Field "markdown" cannot be empty.');
  }

  if (markdown.length > MAX_MARKDOWN_LENGTH) {
    throw new HttpError(413, `Field "markdown" cannot exceed ${MAX_MARKDOWN_LENGTH} characters.`);
  }

  return { inputFormat: 'markdown', content: markdown };
}

function validateOptions(input: unknown): PdfRenderOptions {
  if (!input || typeof input !== 'object') {
    return DEFAULT_OPTIONS;
  }

  const candidate = input as Record<string, unknown>;

  return {
    direction: parseEnum(candidate.direction, allowedDirections, DEFAULT_OPTIONS.direction),
    pageNumbers: parseBoolean(candidate.pageNumbers, DEFAULT_OPTIONS.pageNumbers),
    pageBorder: parseBoolean(candidate.pageBorder, DEFAULT_OPTIONS.pageBorder),
    smartPagination: parseBoolean(candidate.smartPagination, DEFAULT_OPTIONS.smartPagination),
    fontSize: parseEnum(candidate.fontSize, allowedFontSizes, DEFAULT_OPTIONS.fontSize),
    density: parseEnum(candidate.density, allowedDensities, DEFAULT_OPTIONS.density),
    codeWrap: parseBoolean(candidate.codeWrap, DEFAULT_OPTIONS.codeWrap)
  };
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'boolean') {
    return fallback;
  }

  return value;
}

function parseEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  if (typeof value !== 'string') {
    return fallback;
  }

  if (allowed.has(value as T)) {
    return value as T;
  }

  return fallback;
}

function sanitizeFilename(input: string): string {
  const trimmed = input.trim();
  const safeBase = trimmed
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  const finalBase = safeBase || DEFAULT_FILENAME_BASE;
  return `${finalBase}.pdf`;
}
