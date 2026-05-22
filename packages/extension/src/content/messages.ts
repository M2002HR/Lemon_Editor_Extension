import type { DownloadPdfRequest, PdfRenderOptions } from '../types.js';

interface BuildRequestArgs {
  requestId?: string;
  filename: string;
  title: string;
  options: PdfRenderOptions;
  markdown?: string;
  html?: string;
}

export function buildDownloadRequest(args: BuildRequestArgs): DownloadPdfRequest {
  return {
    type: 'DOWNLOAD_PDF_REQUEST',
    payload: {
      requestId: args.requestId,
      markdown: args.markdown,
      html: args.html,
      title: args.title,
      filename: args.filename,
      options: args.options
    }
  };
}
