import type { DownloadPdfRequest, DownloadPdfResult } from './types.js';

const API_BASE_URL = 'http://localhost:4000';

chrome.runtime.onMessage.addListener((message: DownloadPdfRequest, _sender, sendResponse) => {
  if (!message || message.type !== 'DOWNLOAD_PDF_REQUEST') {
    return;
  }

  void handleDownload(message)
    .then((result) => sendResponse(result))
    .catch((error: unknown) => {
      const fallback: DownloadPdfResult = {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown extension error'
      };
      sendResponse(fallback);
    });

  return true;
});

async function handleDownload(message: DownloadPdfRequest): Promise<DownloadPdfResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/markdown-to-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message.payload)
  });

  if (!response.ok) {
    const reason = await safeExtractError(response);
    return { ok: false, error: `Service error (${response.status}): ${reason}` };
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const filename = message.payload.filename ?? buildDefaultFilename();

  try {
    await chrome.downloads.download({
      url: downloadUrl,
      filename,
      saveAs: false
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
  }

  return { ok: true, filename };
}

async function safeExtractError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? 'Unknown error';
  } catch {
    return response.statusText || 'Unknown error';
  }
}

function buildDefaultFilename(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `chatgpt-answer-${yyyy}${mm}${dd}-${hh}${mi}${ss}.pdf`;
}
