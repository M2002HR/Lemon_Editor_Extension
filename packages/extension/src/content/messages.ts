import type { DownloadPdfRequest } from '../types.js';

export function buildDownloadRequest(markdown: string, filename: string, title = 'ChatGPT Answer'): DownloadPdfRequest {
  return {
    type: 'DOWNLOAD_PDF_REQUEST',
    payload: {
      markdown,
      title,
      filename
    }
  };
}
