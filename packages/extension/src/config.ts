declare const __MDPDF_EXTENSION_API_BASE_URL__: string;
declare const __MDPDF_FILENAME_PREFIX__: string;
declare const __MDPDF_PDF_BORDER_CONTENT_PADDING_MM__: string;

const FALLBACK_API_BASE_URL = 'http://localhost:4000';
const FALLBACK_FILENAME_PREFIX = 'chatgpt-answer';
const FALLBACK_BORDER_CONTENT_PADDING_MM = 10;

export const EXTENSION_API_BASE_URL = normalizeApiBaseUrl(
  typeof __MDPDF_EXTENSION_API_BASE_URL__ === 'string' ? __MDPDF_EXTENSION_API_BASE_URL__ : FALLBACK_API_BASE_URL
);

export const EXTENSION_FILENAME_PREFIX = normalizeFilenamePrefix(
  typeof __MDPDF_FILENAME_PREFIX__ === 'string' ? __MDPDF_FILENAME_PREFIX__ : FALLBACK_FILENAME_PREFIX
);

export const EXTENSION_PDF_BORDER_CONTENT_PADDING_MM = normalizeBorderPadding(
  typeof __MDPDF_PDF_BORDER_CONTENT_PADDING_MM__ === 'string'
    ? __MDPDF_PDF_BORDER_CONTENT_PADDING_MM__
    : String(FALLBACK_BORDER_CONTENT_PADDING_MM)
);

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return FALLBACK_API_BASE_URL;
  }

  return trimmed.replace(/\/$/, '');
}

function normalizeFilenamePrefix(value: string): string {
  const safe = value
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  return safe || FALLBACK_FILENAME_PREFIX;
}

function normalizeBorderPadding(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    return FALLBACK_BORDER_CONTENT_PADDING_MM;
  }

  return Math.min(24, Math.max(0, Math.round(parsed * 100) / 100));
}
