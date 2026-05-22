export interface PdfRequestPayload {
  markdown: string;
  title?: string;
  filename?: string;
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
