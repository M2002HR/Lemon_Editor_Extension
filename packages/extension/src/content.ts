import TurndownService from 'turndown';
import type { DownloadPdfResult } from './types.js';
import { ACTION_CLASS, ENHANCED_ATTRIBUTE, buildDefaultFilename, extractMessageHtml, findAssistantMessages } from './content/dom.js';
import { buildDownloadRequest } from './content/messages.js';

const STATUS_CLASS = 'mdpdf-status';
const BUTTON_CLASS = 'mdpdf-button';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

injectStyles();
scanAndEnhance();

const observer = new MutationObserver(() => {
  scanAndEnhance();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function scanAndEnhance() {
  const assistantMessages = findAssistantMessages(document);
  for (const message of assistantMessages) {
    if (message.hasAttribute(ENHANCED_ATTRIBUTE)) {
      continue;
    }

    message.setAttribute(ENHANCED_ATTRIBUTE, 'true');
    attachActionRow(message);
  }
}

function attachActionRow(messageElement: HTMLElement) {
  const actionRow = document.createElement('div');
  actionRow.className = ACTION_CLASS;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = BUTTON_CLASS;
  button.textContent = 'PDF';

  const status = document.createElement('span');
  status.className = STATUS_CLASS;

  button.addEventListener('click', async () => {
    await downloadMessagePdf(messageElement, button, status);
  });

  actionRow.append(button, status);
  messageElement.appendChild(actionRow);
}

async function downloadMessagePdf(messageElement: HTMLElement, button: HTMLButtonElement, status: HTMLElement) {
  setButtonState(button, status, true, 'Converting...');

  try {
    const html = extractMessageHtml(messageElement);
    if (!html.trim()) {
      throw new Error('No message content found.');
    }

    const markdown = turndown.turndown(html);
    const filename = buildDefaultFilename();
    const request = buildDownloadRequest(markdown, filename);

    const result = await sendMessage<DownloadPdfResult>(request);

    if (!result.ok) {
      throw new Error(result.error);
    }

    setButtonState(button, status, false, 'Downloaded');
    window.setTimeout(() => {
      status.textContent = '';
    }, 1800);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export PDF.';
    setButtonState(button, status, false, message);
  }
}

function setButtonState(button: HTMLButtonElement, status: HTMLElement, loading: boolean, message: string) {
  button.disabled = loading;
  status.textContent = message;
}

function sendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function injectStyles() {
  const styleId = 'mdpdf-extension-style';
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .${ACTION_CLASS} {
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .${BUTTON_CLASS} {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 12px;
      cursor: pointer;
    }
    .${BUTTON_CLASS}:disabled {
      opacity: 0.7;
      cursor: wait;
    }
    .${STATUS_CLASS} {
      font-size: 12px;
      color: #475569;
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  document.head.appendChild(style);
}
