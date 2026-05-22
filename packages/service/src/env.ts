import 'dotenv/config';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:*',
  'http://127.0.0.1:*',
  'https://chatgpt.com',
  'https://chat.openai.com'
];

export interface ServiceEnv {
  port: number;
  maxMarkdownLength: number;
  jsonBodyLimit: string;
  defaultFilenameBase: string;
  pdfBorderContentPaddingMm: number;
  allowChromeExtensionOrigins: boolean;
  allowedOrigins: string[];
}

export const serviceEnv: ServiceEnv = {
  port: parseNumber('SERVICE_PORT', process.env.PORT, 4000),
  maxMarkdownLength: parseNumber('SERVICE_MAX_MARKDOWN_LENGTH', undefined, 200_000),
  jsonBodyLimit: (process.env.SERVICE_JSON_BODY_LIMIT ?? '300kb').trim() || '300kb',
  defaultFilenameBase: sanitizeBase(process.env.SERVICE_DEFAULT_FILENAME_BASE ?? 'chatgpt-answer'),
  pdfBorderContentPaddingMm: parseBoundedNumber('SERVICE_PDF_BORDER_CONTENT_PADDING_MM', 10, 0, 24),
  allowChromeExtensionOrigins: parseBoolean(process.env.SERVICE_ALLOW_CHROME_EXTENSION_ORIGINS, true),
  allowedOrigins: parseCsv(process.env.SERVICE_ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS)
};

function parseNumber(name: string, value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return Math.floor(num);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseBoundedNumber(name: string, fallback: number, min: number, max: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}.`);
  }

  return Math.round(num * 100) / 100;
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function sanitizeBase(input: string): string {
  const safeBase = input
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return safeBase || 'chatgpt-answer';
}
