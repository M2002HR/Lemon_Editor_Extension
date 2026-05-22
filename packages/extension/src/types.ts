export type PdfDirection = 'auto' | 'rtl' | 'ltr';
export type PdfFontSize = 'small' | 'medium' | 'large';
export type PdfDensity = 'compact' | 'normal' | 'relaxed';

export interface PdfRenderOptions {
  direction: PdfDirection;
  pageNumbers: boolean;
  pageBorder: boolean;
  smartPagination: boolean;
  fontSize: PdfFontSize;
  density: PdfDensity;
  codeWrap: boolean;
}

export interface PdfRequestPayload {
  requestId?: string;
  markdown?: string;
  html?: string;
  title?: string;
  filename?: string;
  options?: PdfRenderOptions;
}

export interface DownloadPdfRequest {
  type: 'DOWNLOAD_PDF_REQUEST';
  payload: PdfRequestPayload;
}

export interface DownloadPdfSuccess {
  ok: true;
  filename: string;
}

export interface DownloadPdfFailure {
  ok: false;
  error: string;
}

export type DownloadPdfResult = DownloadPdfSuccess | DownloadPdfFailure;

export interface DownloadPdfProgressEvent {
  type: 'DOWNLOAD_PDF_PROGRESS';
  requestId: string;
  phase: 'request' | 'rendering' | 'receiving' | 'encoding' | 'downloading' | 'done';
  progress?: number;
  message?: string;
}
