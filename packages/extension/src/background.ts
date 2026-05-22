import { EXTENSION_API_BASE_URL } from './config.js';
import { buildDefaultFilename } from './shared/filename.js';
import type { DownloadPdfProgressEvent, DownloadPdfRequest, DownloadPdfResult } from './types.js';

chrome.runtime.onMessage.addListener((message: DownloadPdfRequest, sender, sendResponse) => {
  if (!message || message.type !== 'DOWNLOAD_PDF_REQUEST') {
    return;
  }

  void handleDownload(message, sender)
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

async function handleDownload(message: DownloadPdfRequest, sender: chrome.runtime.MessageSender): Promise<DownloadPdfResult> {
  const requestId = message.payload.requestId ?? '';
  sendProgress(sender, {
    type: 'DOWNLOAD_PDF_PROGRESS',
    requestId,
    phase: 'request',
    progress: 0,
    message: 'Sending request...'
  });

  const response = await fetch(`${EXTENSION_API_BASE_URL}/api/v1/markdown-to-pdf`, {
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

  sendProgress(sender, {
    type: 'DOWNLOAD_PDF_PROGRESS',
    requestId,
    phase: 'receiving',
    progress: 5,
    message: 'Receiving PDF bytes...'
  });

  const blob = await readResponseAsBlob(response, sender, requestId);

  sendProgress(sender, {
    type: 'DOWNLOAD_PDF_PROGRESS',
    requestId,
    phase: 'encoding',
    progress: 85,
    message: 'Preparing download...'
  });

  const dataUrl = await blobToDataUrl(blob);
  const filename = message.payload.filename ?? buildDefaultFilename();

  sendProgress(sender, {
    type: 'DOWNLOAD_PDF_PROGRESS',
    requestId,
    phase: 'downloading',
    progress: 95,
    message: 'Downloading file...'
  });

  await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: false
  });

  sendProgress(sender, {
    type: 'DOWNLOAD_PDF_PROGRESS',
    requestId,
    phase: 'done',
    progress: 100,
    message: 'Done'
  });

  return { ok: true, filename };
}

async function readResponseAsBlob(
  response: Response,
  sender: chrome.runtime.MessageSender,
  requestId: string
): Promise<Blob> {
  if (!response.body) {
    return response.blob();
  }

  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  const total = Number(response.headers.get('content-length') ?? 0);
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      chunks.push(Uint8Array.from(value).buffer);
      received += value.byteLength;

      const progress = total > 0 ? Math.min(84, 5 + Math.floor((received / total) * 78)) : undefined;
      sendProgress(sender, {
        type: 'DOWNLOAD_PDF_PROGRESS',
        requestId,
        phase: 'receiving',
        progress,
        message: total > 0 ? `Receiving PDF... ${Math.floor((received / total) * 100)}%` : 'Receiving PDF...'
      });
    }
  }

  return new Blob(chunks, { type: response.headers.get('content-type') ?? 'application/pdf' });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  const mimeType = blob.type || 'application/pdf';
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function safeExtractError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? 'Unknown error';
  } catch {
    return response.statusText || 'Unknown error';
  }
}

function sendProgress(sender: chrome.runtime.MessageSender, event: DownloadPdfProgressEvent) {
  const tabId = sender.tab?.id;
  if (!tabId || !event.requestId) {
    return;
  }

  void chrome.tabs.sendMessage(tabId, event);
}
