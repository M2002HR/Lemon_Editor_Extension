export interface MarkdownToPdfRequestBody {
  markdown?: unknown;
  title?: unknown;
  filename?: unknown;
}

export interface ValidatedPayload {
  markdown: string;
  title?: string;
  filename: string;
}
