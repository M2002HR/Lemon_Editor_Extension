import { serviceEnv } from './env.js';

export const DEFAULT_PORT = serviceEnv.port;
export const MAX_MARKDOWN_LENGTH = serviceEnv.maxMarkdownLength;
export const JSON_BODY_LIMIT = serviceEnv.jsonBodyLimit;
export const DEFAULT_FILENAME_BASE = serviceEnv.defaultFilenameBase;
export const PDF_BORDER_CONTENT_PADDING_MM = serviceEnv.pdfBorderContentPaddingMm;
export const ALLOW_CHROME_EXTENSION_ORIGINS = serviceEnv.allowChromeExtensionOrigins;
export const ALLOWED_ORIGIN_PATTERNS = serviceEnv.allowedOrigins;
