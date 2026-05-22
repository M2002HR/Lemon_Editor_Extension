import TurndownService from 'turndown';
import { ACTION_CLASS, ENHANCED_ATTRIBUTE, buildDefaultFilename, extractMessageHtml, findAssistantMessages } from './content/dom.js';
import { openAdvancedEditor } from './editor.js';
import { buildDownloadRequest } from './content/messages.js';
import { getStoredExportOptions, normalizeExportOptions, saveExportOptions } from './options.js';
import type { DownloadPdfProgressEvent, DownloadPdfResult, PdfRenderOptions } from './types.js';

const STATUS_CLASS = 'mdpdf-status';
const BUTTON_CLASS = 'mdpdf-button';
const PROGRESS_WRAP_CLASS = 'mdpdf-progress-wrap';
const PROGRESS_BAR_CLASS = 'mdpdf-progress-bar';
const PROGRESS_VALUE_CLASS = 'mdpdf-progress-value';
const PROGRESS_LABEL_CLASS = 'mdpdf-progress-label';
const DIALOG_BACKDROP_ID = 'mdpdf-dialog-backdrop';
const BRAND_MARK_URL = chrome.runtime.getURL('branding/lemon-editor-mark-512.png');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

turndown.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);

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
  button.innerHTML = `${pdfIconSvg()}<span>Export PDF</span>`;

  const status = document.createElement('span');
  status.className = STATUS_CLASS;

  const progressWrap = document.createElement('div');
  progressWrap.className = PROGRESS_WRAP_CLASS;
  progressWrap.innerHTML = `
    <div class="${PROGRESS_BAR_CLASS}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="${PROGRESS_VALUE_CLASS}"></div>
    </div>
    <span class="${PROGRESS_LABEL_CLASS}"></span>
  `;
  progressWrap.hidden = true;

  button.addEventListener('click', async () => {
    await handleExportClick(messageElement, {
      button,
      status,
      progressWrap,
      progressValue: progressWrap.querySelector<HTMLElement>(`.${PROGRESS_VALUE_CLASS}`),
      progressLabel: progressWrap.querySelector<HTMLElement>(`.${PROGRESS_LABEL_CLASS}`),
      progressBar: progressWrap.querySelector<HTMLElement>(`.${PROGRESS_BAR_CLASS}`)
    });
  });

  actionRow.append(button, status, progressWrap);
  messageElement.appendChild(actionRow);
}

interface ActionUi {
  button: HTMLButtonElement;
  status: HTMLElement;
  progressWrap: HTMLElement;
  progressValue: HTMLElement | null;
  progressLabel: HTMLElement | null;
  progressBar: HTMLElement | null;
}

async function handleExportClick(messageElement: HTMLElement, ui: ActionUi) {
  setButtonState(ui.button, ui.status, true, 'Preparing export settings...');

  try {
    const sourceHtml = extractMessageHtml(messageElement);
    if (!sourceHtml.trim()) {
      throw new Error('No message content found.');
    }

    const markdown = turndown.turndown(sourceHtml);
    const initialOptions = await getStoredExportOptions().catch(() => normalizeExportOptions(undefined));
    const initialFilename = buildDefaultFilename();

    const selection = await openSettingsDialog(initialOptions, initialFilename);
    if (!selection) {
      setButtonState(ui.button, ui.status, false, 'Export cancelled');
      window.setTimeout(() => {
        ui.status.textContent = '';
      }, 1200);
      return;
    }

    if (selection.kind === 'editor') {
      await launchAdvancedEditorFlow(sourceHtml, selection, ui);
      return;
    }

    if (selection.saveAsDefault) {
      await saveExportOptions(selection.options);
    }

    setButtonState(ui.button, ui.status, true, 'Rendering PDF...');

    const requestId = createRequestId();
    const request = buildDownloadRequest({
      requestId,
      markdown,
      title: 'ChatGPT Answer',
      filename: selection.filename,
      options: selection.options
    });

    const result = await sendMessageWithProgress(requestId, request, ui);
    if (!result.ok) {
      throw new Error(result.error);
    }

    setButtonState(ui.button, ui.status, false, 'Downloaded successfully');
    window.setTimeout(() => {
      ui.status.textContent = '';
    }, 2200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export PDF.';
    setButtonState(ui.button, ui.status, false, message);
    resetProgressUi(ui);
  }
}

async function launchAdvancedEditorFlow(
  sourceHtml: string,
  selection: Extract<DialogSelection, { kind: 'editor' }>,
  ui: ActionUi
) {
  const editorResult = await openAdvancedEditor({
    html: sourceHtml,
    filename: selection.filename,
    options: selection.options
  });

  if (!editorResult) {
    setButtonState(ui.button, ui.status, false, 'Editor closed');
    window.setTimeout(() => {
      ui.status.textContent = '';
    }, 1200);
    return;
  }

  if (editorResult.saveAsDefault) {
    await saveExportOptions(editorResult.options);
  }

  setButtonState(ui.button, ui.status, true, 'Rendering edited content...');

  const requestId = createRequestId();
  const request = buildDownloadRequest({
    requestId,
    html: editorResult.html,
    title: 'ChatGPT Answer',
    filename: editorResult.filename,
    options: editorResult.options
  });

  const result = await sendMessageWithProgress(requestId, request, ui);
  if (!result.ok) {
    throw new Error(result.error);
  }

  setButtonState(ui.button, ui.status, false, 'Downloaded successfully');
  window.setTimeout(() => {
    ui.status.textContent = '';
  }, 2200);
}

type DialogSelection =
  | {
      kind: 'export';
      filename: string;
      options: PdfRenderOptions;
      saveAsDefault: boolean;
    }
  | {
      kind: 'editor';
      filename: string;
      options: PdfRenderOptions;
    };

function openSettingsDialog(defaults: PdfRenderOptions, initialFilename: string): Promise<DialogSelection | null> {
  closeExistingDialog();

  const backdrop = document.createElement('div');
  backdrop.id = DIALOG_BACKDROP_ID;
  backdrop.className = 'mdpdf-dialog-backdrop';
  backdrop.innerHTML = `
    <div class="mdpdf-dialog" role="dialog" aria-modal="true" aria-label="PDF export settings">
      <div class="mdpdf-dialog-header">
        <div class="mdpdf-dialog-brand"><img src="${BRAND_MARK_URL}" alt="Lemon Editor" /></div>
        <div>
          <h3>PDF Export Settings</h3>
          <p>Choose layout options, then export directly or open full editor.</p>
        </div>
        <button type="button" class="mdpdf-close-btn" aria-label="Close">✕</button>
      </div>

      <div class="mdpdf-grid">
        <label>
          <span>File name</span>
          <input class="mdpdf-input" name="filename" type="text" value="${escapeAttribute(initialFilename)}" />
        </label>

        <label>
          <span>Text direction</span>
          <select class="mdpdf-input" name="direction">
            <option value="auto">Auto detect</option>
            <option value="rtl">RTL (Persian/Arabic)</option>
            <option value="ltr">LTR (English)</option>
          </select>
        </label>

        <label>
          <span>Font size</span>
          <select class="mdpdf-input" name="fontSize">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>

        <label>
          <span>Density</span>
          <select class="mdpdf-input" name="density">
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </label>
      </div>

      <div class="mdpdf-toggles">
        <label><input type="checkbox" name="smartPagination" /> Smart pagination</label>
        <label><input type="checkbox" name="pageBorder" /> Border on each page</label>
        <label><input type="checkbox" name="pageNumbers" /> Show page numbers</label>
        <label><input type="checkbox" name="codeWrap" /> Wrap long code lines</label>
        <label><input type="checkbox" name="saveAsDefault" /> Save these settings as default</label>
      </div>

      <div class="mdpdf-dialog-footer">
        <button type="button" class="mdpdf-btn mdfpd-btn-secondary" data-action="cancel">Cancel</button>
        <button type="button" class="mdpdf-btn mdfpd-btn-tertiary" data-action="editor">Open Full Editor</button>
        <button type="button" class="mdpdf-btn mdfpd-btn-primary" data-action="export">Export PDF</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const filenameInput = backdrop.querySelector<HTMLInputElement>('input[name="filename"]');
  const directionSelect = backdrop.querySelector<HTMLSelectElement>('select[name="direction"]');
  const fontSizeSelect = backdrop.querySelector<HTMLSelectElement>('select[name="fontSize"]');
  const densitySelect = backdrop.querySelector<HTMLSelectElement>('select[name="density"]');
  const smartPaginationInput = backdrop.querySelector<HTMLInputElement>('input[name="smartPagination"]');
  const pageBorderInput = backdrop.querySelector<HTMLInputElement>('input[name="pageBorder"]');
  const pageNumbersInput = backdrop.querySelector<HTMLInputElement>('input[name="pageNumbers"]');
  const codeWrapInput = backdrop.querySelector<HTMLInputElement>('input[name="codeWrap"]');
  const saveAsDefaultInput = backdrop.querySelector<HTMLInputElement>('input[name="saveAsDefault"]');

  if (
    !filenameInput ||
    !directionSelect ||
    !fontSizeSelect ||
    !densitySelect ||
    !smartPaginationInput ||
    !pageBorderInput ||
    !pageNumbersInput ||
    !codeWrapInput ||
    !saveAsDefaultInput
  ) {
    backdrop.remove();
    return Promise.resolve(null);
  }

  directionSelect.value = defaults.direction;
  fontSizeSelect.value = defaults.fontSize;
  densitySelect.value = defaults.density;
  smartPaginationInput.checked = defaults.smartPagination;
  pageBorderInput.checked = defaults.pageBorder;
  pageNumbersInput.checked = defaults.pageNumbers;
  codeWrapInput.checked = defaults.codeWrap;

  filenameInput.focus();

  return new Promise((resolve) => {
    const close = (result: DialogSelection | null) => {
      backdrop.remove();
      resolve(result);
    };

    const cancel = () => close(null);

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        cancel();
      }
    });

    backdrop.querySelector('.mdpdf-close-btn')?.addEventListener('click', cancel);
    backdrop.querySelector('[data-action="cancel"]')?.addEventListener('click', cancel);

    const collectOptions = () => {
      const filename = normalizeFilename(filenameInput.value, initialFilename);
      const options = normalizeExportOptions({
        direction: directionSelect.value,
        fontSize: fontSizeSelect.value,
        density: densitySelect.value,
        smartPagination: smartPaginationInput.checked,
        pageBorder: pageBorderInput.checked,
        pageNumbers: pageNumbersInput.checked,
        codeWrap: codeWrapInput.checked
      });

      return {
        filename,
        options,
        saveAsDefault: saveAsDefaultInput.checked
      };
    };

    backdrop.querySelector('[data-action="editor"]')?.addEventListener('click', () => {
      const values = collectOptions();
      close({
        kind: 'editor',
        filename: values.filename,
        options: values.options
      });
    });

    backdrop.querySelector('[data-action="export"]')?.addEventListener('click', () => {
      const values = collectOptions();
      close({
        kind: 'export',
        filename: values.filename,
        options: values.options,
        saveAsDefault: values.saveAsDefault
      });
    });

    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    });
  });
}

function normalizeFilename(value: string, fallback: string): string {
  const safe = value
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  const base = safe || fallback.replace(/\.pdf$/i, '');
  return `${base}.pdf`;
}

function closeExistingDialog() {
  const previous = document.getElementById(DIALOG_BACKDROP_ID);
  if (previous) {
    previous.remove();
  }
}

function setButtonState(button: HTMLButtonElement, status: HTMLElement, loading: boolean, message: string) {
  button.disabled = loading;
  status.textContent = message;
}

function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function sendMessageWithProgress(requestId: string, message: unknown, ui: ActionUi): Promise<DownloadPdfResult> {
  showProgressUi(ui);
  setProgress(ui, 2, 'Sending request...');

  const onProgress = (event: DownloadPdfProgressEvent) => {
    if (event.type !== 'DOWNLOAD_PDF_PROGRESS' || event.requestId !== requestId) {
      return;
    }

    if (typeof event.progress === 'number') {
      setProgress(ui, event.progress, event.message ?? 'Working...');
    } else {
      setProgress(ui, undefined, event.message ?? 'Working...');
    }
  };

  chrome.runtime.onMessage.addListener(onProgress as unknown as (message: unknown, sender: chrome.runtime.MessageSender) => void);

  try {
    const result = await sendMessage<DownloadPdfResult>(message);
    setProgress(ui, 100, 'Completed');
    window.setTimeout(() => {
      resetProgressUi(ui);
    }, 700);
    return result;
  } finally {
    chrome.runtime.onMessage.removeListener(onProgress as unknown as (message: unknown, sender: chrome.runtime.MessageSender) => void);
  }
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

function showProgressUi(ui: ActionUi) {
  ui.progressWrap.hidden = false;
}

function resetProgressUi(ui: ActionUi) {
  ui.progressWrap.hidden = true;
  if (ui.progressValue) {
    ui.progressValue.style.width = '0%';
  }
  if (ui.progressLabel) {
    ui.progressLabel.textContent = '';
  }
  if (ui.progressBar) {
    ui.progressBar.classList.remove('mdpdf-indeterminate');
    ui.progressBar.setAttribute('aria-valuenow', '0');
  }
}

function setProgress(ui: ActionUi, value: number | undefined, label: string) {
  if (ui.progressLabel) {
    ui.progressLabel.textContent = label;
  }

  if (!ui.progressBar || !ui.progressValue) {
    return;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    ui.progressBar.classList.add('mdpdf-indeterminate');
    ui.progressBar.removeAttribute('aria-valuenow');
    ui.progressValue.style.width = '40%';
    return;
  }

  const clamped = Math.max(0, Math.min(100, value));
  ui.progressBar.classList.remove('mdpdf-indeterminate');
  ui.progressBar.setAttribute('aria-valuenow', String(clamped));
  ui.progressValue.style.width = `${clamped}%`;
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
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .${BUTTON_CLASS} {
      border: 1px solid #c2d7ff;
      background: linear-gradient(145deg, #f8fbff 0%, #edf5ff 100%);
      color: #0f2f63;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: transform 0.14s ease, box-shadow 0.14s ease;
      box-shadow: 0 1px 0 rgba(26, 74, 143, 0.06), 0 4px 12px rgba(26, 74, 143, 0.1);
    }

    .${BUTTON_CLASS}:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(26, 74, 143, 0.14);
    }

    .${BUTTON_CLASS}:disabled {
      opacity: 0.72;
      cursor: wait;
      transform: none;
    }

    .${BUTTON_CLASS} svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    .${STATUS_CLASS} {
      font-size: 12px;
      color: #475569;
      max-width: 380px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .${PROGRESS_WRAP_CLASS} {
      min-width: 220px;
      display: grid;
      gap: 4px;
    }

    .${PROGRESS_BAR_CLASS} {
      position: relative;
      height: 8px;
      border-radius: 999px;
      background: #dbeafe;
      overflow: hidden;
    }

    .${PROGRESS_VALUE_CLASS} {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #2563eb, #0f766e);
      border-radius: inherit;
      transition: width 0.25s ease;
    }

    .${PROGRESS_LABEL_CLASS} {
      font-size: 11px;
      color: #475569;
    }

    .${PROGRESS_BAR_CLASS}.mdpdf-indeterminate .${PROGRESS_VALUE_CLASS} {
      width: 40%;
      animation: mdpdf-indeterminate 1s linear infinite;
    }

    @keyframes mdpdf-indeterminate {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(300%); }
    }

    .mdpdf-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .mdpdf-dialog {
      width: min(760px, 100%);
      background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      border: 1px solid #d3e4ff;
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
      padding: 16px;
      color: #0f172a;
      font-family: "Segoe UI", Tahoma, sans-serif;
    }

    .mdpdf-dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 14px;
    }

    .mdpdf-dialog-header h3 {
      margin: 0;
      font-size: 18px;
      line-height: 1.25;
    }

    .mdpdf-dialog-brand img {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      border: 1px solid #c8d8f3;
      background: #fff;
      margin-top: 2px;
    }

    .mdpdf-dialog-header p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #334155;
    }

    .mdpdf-close-btn {
      background: #fff;
      border: 1px solid #d6e4ff;
      border-radius: 10px;
      width: 30px;
      height: 30px;
      cursor: pointer;
      color: #0f2f63;
      font-size: 15px;
      line-height: 1;
    }

    .mdpdf-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }

    .mdpdf-grid label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
    }

    .mdpdf-input {
      border: 1px solid #cad8f3;
      border-radius: 10px;
      padding: 9px 10px;
      font-size: 13px;
      background: #fff;
      color: #0f172a;
      outline: none;
    }

    .mdpdf-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .mdpdf-toggles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #1f2937;
    }

    .mdpdf-toggles label {
      display: flex;
      align-items: center;
      gap: 8px;
      line-height: 1.25;
      user-select: none;
    }

    .mdpdf-dialog-footer {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 6px;
    }

    .mdpdf-btn {
      border-radius: 12px;
      border: 1px solid transparent;
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .mdfpd-btn-secondary {
      background: #fff;
      border-color: #c8d5ea;
      color: #1e293b;
    }

    .mdfpd-btn-tertiary {
      background: #fff;
      border-color: #9dc4f7;
      color: #0f4c81;
    }

    .mdfpd-btn-primary {
      background: linear-gradient(135deg, #1d4ed8, #0f766e);
      color: #fff;
      box-shadow: 0 8px 24px rgba(29, 78, 216, 0.28);
    }

    @media (max-width: 640px) {
      .mdpdf-grid,
      .mdpdf-toggles {
        grid-template-columns: 1fr;
      }

      .mdpdf-dialog {
        border-radius: 14px;
      }
    }
  `;

  document.head.appendChild(style);
}

function pdfIconSvg(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6.2 2.5h7.8l4.8 4.8v11.5c0 1.5-1.2 2.7-2.7 2.7H6.2c-1.5 0-2.7-1.2-2.7-2.7V5.2c0-1.5 1.2-2.7 2.7-2.7z" fill="#eaf2ff" stroke="#aac7f5"/>
    <path d="M14 2.6v4.2c0 .8.6 1.4 1.4 1.4h4.2" fill="none" stroke="#aac7f5"/>
    <path d="M12 9v6.7" stroke="#1d4ed8" stroke-width="2" stroke-linecap="round"/>
    <path d="m9.4 13.9 2.6 2.7 2.6-2.7" fill="none" stroke="#0f766e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="7.2" y="17.8" width="9.6" height="1.8" rx="0.9" fill="#1d4ed8"/>
  </svg>`;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
