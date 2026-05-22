export type PdfDirection = 'auto' | 'rtl' | 'ltr';
export type PdfFontSize = 'small' | 'medium' | 'large';
export type PdfDensity = 'compact' | 'normal' | 'relaxed';
export type PdfInputFormat = 'markdown' | 'html';

export interface PdfRenderOptions {
  direction: PdfDirection;
  pageNumbers: boolean;
  pageBorder: boolean;
  smartPagination: boolean;
  fontSize: PdfFontSize;
  density: PdfDensity;
  codeWrap: boolean;
}

export interface MarkdownToPdfRequestBody {
  markdown?: unknown;
  html?: unknown;
  title?: unknown;
  filename?: unknown;
  options?: unknown;
}

export interface ValidatedPayload {
  inputFormat: PdfInputFormat;
  content: string;
  title?: string;
  filename: string;
  options: PdfRenderOptions;
}
