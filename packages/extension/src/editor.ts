import { buildDefaultFilename } from './content/dom.js';
import { EXTENSION_API_BASE_URL } from './config.js';
import { buildFontFaceCss, getFontFamilies } from './fonts.js';
import { normalizeExportOptions } from './options.js';
import type { PdfRenderOptions } from './types.js';

interface OpenEditorArgs {
  html: string;
  filename: string;
  options: PdfRenderOptions;
}

export interface EditorExportResult {
  filename: string;
  html: string;
  options: PdfRenderOptions;
  saveAsDefault: boolean;
}

const EDITOR_BACKDROP_ID = 'mdpdf-editor-backdrop';
const BRAND_MARK_URL = chrome.runtime.getURL('branding/lemon-editor-mark-512.png');
const rtlScript = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

interface SerializedSelection {
  startPath: number[];
  startOffset: number;
  endPath: number[];
  endOffset: number;
}

interface HistorySnapshot {
  html: string;
  selection: SerializedSelection | null;
  sidebar: SidebarSnapshot;
}

interface SidebarSnapshot {
  filename: string;
  direction: PdfRenderOptions['direction'];
  fontSize: PdfRenderOptions['fontSize'];
  density: PdfRenderOptions['density'];
  smartPagination: boolean;
  pageBorder: boolean;
  pageNumbers: boolean;
  codeWrap: boolean;
}

export function openAdvancedEditor(args: OpenEditorArgs): Promise<EditorExportResult | null> {
  closeAdvancedEditor();

  const backdrop = document.createElement('div');
  backdrop.id = EDITOR_BACKDROP_ID;
  backdrop.className = 'mdpdf-editor-backdrop';

  const fontOptions = ['System UI', 'Tahoma', 'Vazirmatn', ...getFontFamilies()]
    .map((family) => `<option value="${escapeAttribute(family)}">${escapeHtml(family)}</option>`)
    .join('');

  backdrop.innerHTML = `
    <style>
      ${buildFontFaceCss()}
      ${editorUiCss()}
    </style>
    <div class="mdpdf-editor-shell" role="dialog" aria-modal="true" aria-label="Advanced PDF editor">
      <header class="mdpdf-editor-topbar">
        <div class="mdpdf-editor-brand">
          <img src="${BRAND_MARK_URL}" alt="Lemon Editor mark" />
          <div>
            <h2>Advanced PDF Editor</h2>
            <p>Live preview updates as you edit and change PDF options.</p>
          </div>
        </div>
        <button type="button" class="mdpdf-editor-close" aria-label="Close">✕</button>
      </header>

      <div class="mdpdf-editor-main">
        <section class="mdpdf-editor-left">
          <div class="mdpdf-editor-toolbar" role="toolbar" aria-label="Text tools">
            <button type="button" data-action="undo" title="Undo">Undo</button>
            <button type="button" data-action="redo" title="Redo">Redo</button>
            <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
            <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
            <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
            <button type="button" data-list="ul" title="Bulleted list">• List</button>
            <button type="button" data-list="ol" title="Numbered list">1. List</button>
            <button type="button" data-block="p" title="Paragraph">P</button>
            <button type="button" data-block="h2" title="Heading 2">H2</button>

            <select class="mdpdf-editor-select" name="fontFamily" title="Font family">
              <option value="">Font</option>
              ${fontOptions}
            </select>

            <select class="mdpdf-editor-select" name="fontSizePx" title="Selected text size">
              <option value="">Text size</option>
              <option value="12">12px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
              <option value="24">24px</option>
              <option value="28">28px</option>
              <option value="32">32px</option>
            </select>

            <label class="mdpdf-color-tool" title="Text color">
              <span>Text</span>
              <input type="color" name="textColor" value="#0f172a" />
            </label>
            <label class="mdpdf-color-tool" title="Highlight color">
              <span>Mark</span>
              <input type="color" name="highlightColor" value="#fff59d" />
            </label>

            <button type="button" data-action="applyTextColor" title="Apply text color">Apply Text</button>
            <button type="button" data-action="applyHighlight" title="Apply highlight">Apply Mark</button>

            <button type="button" data-dir="rtl" title="Current line RTL">RTL Line</button>
            <button type="button" data-dir="ltr" title="Current line LTR">LTR Line</button>
            <button type="button" data-cmd="removeFormat" title="Remove inline formatting">Clear</button>
          </div>

          <div class="mdpdf-editor-canvas-wrap">
            <div class="mdpdf-page-overlay"></div>
            <div class="mdpdf-editor-canvas" contenteditable="true" spellcheck="false"></div>
          </div>
        </section>

        <aside class="mdpdf-editor-right">
          <label>
            <span>File name</span>
            <input name="filename" type="text" value="${escapeAttribute(args.filename || buildDefaultFilename())}" />
          </label>

          <label>
            <span>Direction</span>
            <select name="direction">
              <option value="auto">Auto detect</option>
              <option value="rtl">RTL</option>
              <option value="ltr">LTR</option>
            </select>
          </label>

          <label>
            <span>Font size</span>
            <select name="fontSize">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>

          <label>
            <span>Density</span>
            <select name="density">
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="relaxed">Relaxed</option>
            </select>
          </label>

          <label class="mdpdf-editor-check"><input type="checkbox" name="smartPagination" /> Smart pagination</label>
          <label class="mdpdf-editor-check"><input type="checkbox" name="pageBorder" /> Border for each page</label>
          <label class="mdpdf-editor-check"><input type="checkbox" name="pageNumbers" /> Page numbers</label>
          <label class="mdpdf-editor-check"><input type="checkbox" name="codeWrap" /> Wrap long code lines</label>
          <label class="mdpdf-editor-check"><input type="checkbox" name="saveAsDefault" /> Save as default settings</label>

          <p class="mdpdf-editor-note">Preview is live and uses the same render options used for final PDF download.</p>

          <div class="mdpdf-live-preview">
            <div class="mdpdf-live-preview-header">
              <strong>Final PDF Live Preview</strong>
              <span class="mdpdf-live-preview-status">Idle</span>
            </div>
            <div class="mdpdf-live-preview-frame-wrap">
              <iframe class="mdpdf-live-preview-frame" title="Live PDF preview"></iframe>
            </div>
          </div>

          <div class="mdpdf-editor-actions">
            <button type="button" class="mdpdf-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="mdpdf-primary" data-action="download">Download PDF</button>
          </div>
        </aside>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const editor = backdrop.querySelector<HTMLElement>('.mdpdf-editor-canvas');
  const canvasWrap = backdrop.querySelector<HTMLElement>('.mdpdf-editor-canvas-wrap');
  const overlay = backdrop.querySelector<HTMLElement>('.mdpdf-page-overlay');
  const filenameInput = backdrop.querySelector<HTMLInputElement>('input[name="filename"]');
  const directionSelect = backdrop.querySelector<HTMLSelectElement>('select[name="direction"]');
  const fontSizeSelect = backdrop.querySelector<HTMLSelectElement>('select[name="fontSize"]');
  const densitySelect = backdrop.querySelector<HTMLSelectElement>('select[name="density"]');
  const smartPaginationInput = backdrop.querySelector<HTMLInputElement>('input[name="smartPagination"]');
  const pageBorderInput = backdrop.querySelector<HTMLInputElement>('input[name="pageBorder"]');
  const pageNumbersInput = backdrop.querySelector<HTMLInputElement>('input[name="pageNumbers"]');
  const codeWrapInput = backdrop.querySelector<HTMLInputElement>('input[name="codeWrap"]');
  const saveAsDefaultInput = backdrop.querySelector<HTMLInputElement>('input[name="saveAsDefault"]');
  const livePreviewFrame = backdrop.querySelector<HTMLIFrameElement>('.mdpdf-live-preview-frame');
  const livePreviewStatus = backdrop.querySelector<HTMLElement>('.mdpdf-live-preview-status');

  if (
    !editor ||
    !canvasWrap ||
    !overlay ||
    !filenameInput ||
    !directionSelect ||
    !fontSizeSelect ||
    !densitySelect ||
    !smartPaginationInput ||
    !pageBorderInput ||
    !pageNumbersInput ||
    !codeWrapInput ||
    !saveAsDefaultInput ||
    !livePreviewFrame ||
    !livePreviewStatus
  ) {
    backdrop.remove();
    return Promise.resolve(null);
  }

  editor.innerHTML = args.html;

  directionSelect.value = args.options.direction;
  fontSizeSelect.value = args.options.fontSize;
  densitySelect.value = args.options.density;
  smartPaginationInput.checked = args.options.smartPagination;
  pageBorderInput.checked = args.options.pageBorder;
  pageNumbersInput.checked = args.options.pageNumbers;
  codeWrapInput.checked = args.options.codeWrap;

  const readOptionsFromSidebar = () =>
    normalizeExportOptions({
      direction: directionSelect.value,
      fontSize: fontSizeSelect.value,
      density: densitySelect.value,
      smartPagination: smartPaginationInput.checked,
      pageBorder: pageBorderInput.checked,
      pageNumbers: pageNumbersInput.checked,
      codeWrap: codeWrapInput.checked
    });

  const readSidebarSnapshot = (): SidebarSnapshot => ({
    filename: filenameInput.value,
    direction: normalizeDirectionValue(directionSelect.value),
    fontSize: normalizeFontSizeValue(fontSizeSelect.value),
    density: normalizeDensityValue(densitySelect.value),
    smartPagination: smartPaginationInput.checked,
    pageBorder: pageBorderInput.checked,
    pageNumbers: pageNumbersInput.checked,
    codeWrap: codeWrapInput.checked
  });

  const applySidebarSnapshot = (sidebar: SidebarSnapshot) => {
    filenameInput.value = sidebar.filename;
    directionSelect.value = sidebar.direction;
    fontSizeSelect.value = sidebar.fontSize;
    densitySelect.value = sidebar.density;
    smartPaginationInput.checked = sidebar.smartPagination;
    pageBorderInput.checked = sidebar.pageBorder;
    pageNumbersInput.checked = sidebar.pageNumbers;
    codeWrapInput.checked = sidebar.codeWrap;
  };

  let savedRange: Range | null = null;
  const history: {
    snapshots: HistorySnapshot[];
    index: number;
    applying: boolean;
  } = {
    snapshots: [],
    index: -1,
    applying: false
  };

  let previewTimer: number | null = null;
  let previewAbort: AbortController | null = null;
  let previewUrl: string | null = null;
  const storeSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedRange) return;
    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(savedRange);
  };

  const syncLivePreview = () => {
    const options = readOptionsFromSidebar();
    applyPreviewSettings(editor, canvasWrap, overlay, options);
    renderPageOverlay(editor, overlay, options.pageBorder, options.pageNumbers);
    schedulePdfPreview();
  };

  const onSelectionChange = () => {
    if (history.applying) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  };

  const pushHistory = (force = false) => {
    if (history.applying) {
      return;
    }

    const snapshot: HistorySnapshot = {
      html: editor.innerHTML,
      selection: serializeSelection(editor),
      sidebar: readSidebarSnapshot()
    };

    const current = history.snapshots[history.index];
    if (!force && current && current.html === snapshot.html && areSidebarSnapshotsEqual(current.sidebar, snapshot.sidebar)) {
      return;
    }

    history.snapshots = history.snapshots.slice(0, history.index + 1);
    history.snapshots.push(snapshot);

    if (history.snapshots.length > 180) {
      history.snapshots.shift();
    }

    history.index = history.snapshots.length - 1;
  };

  const applyHistorySnapshot = (snapshot: HistorySnapshot) => {
    history.applying = true;
    applySidebarSnapshot(snapshot.sidebar);
    editor.innerHTML = snapshot.html;
    if (snapshot.selection) {
      restoreSerializedSelection(editor, snapshot.selection);
    } else {
      placeCaretAtEnd(editor);
    }
    history.applying = false;
    storeSelection();
    syncLivePreview();
  };

  const undoHistory = () => {
    if (history.index <= 0) {
      return;
    }
    history.index -= 1;
    const snapshot = history.snapshots[history.index];
    if (snapshot) {
      applyHistorySnapshot(snapshot);
    }
  };

  const redoHistory = () => {
    if (history.index >= history.snapshots.length - 1) {
      return;
    }
    history.index += 1;
    const snapshot = history.snapshots[history.index];
    if (snapshot) {
      applyHistorySnapshot(snapshot);
    }
  };

  const setLivePreviewStatus = (text: string, loading = false) => {
    livePreviewStatus.textContent = text;
    livePreviewStatus.classList.toggle('mdpdf-loading', loading);
  };

  const schedulePdfPreview = () => {
    if (previewTimer !== null) {
      window.clearTimeout(previewTimer);
    }
    previewTimer = window.setTimeout(() => {
      previewTimer = null;
      void updatePdfPreview();
    }, 550);
  };

  const updatePdfPreview = async () => {
    const options = readOptionsFromSidebar();
    const payload = {
      html: editor.innerHTML,
      options
    };

    if (previewAbort) {
      previewAbort.abort();
    }
    previewAbort = new AbortController();

    setLivePreviewStatus('Rendering preview...', true);

    try {
      const response = await fetch(`${EXTENSION_API_BASE_URL}/api/v1/markdown-to-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: previewAbort.signal
      });

      if (!response.ok) {
        const reason = await safeTextFromResponse(response);
        throw new Error(`Preview failed (${response.status}): ${reason}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrl = url;
      livePreviewFrame.src = url;
      setLivePreviewStatus('Preview up to date');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      const message = error instanceof Error ? error.message : 'Preview failed';
      setLivePreviewStatus(message);
    }
  };

  wireToolbar(backdrop, editor, restoreSelection, storeSelection, syncLivePreview, undoHistory, redoHistory, pushHistory);

  document.addEventListener('selectionchange', onSelectionChange);
  editor.addEventListener('keyup', storeSelection);
  editor.addEventListener('mouseup', storeSelection);
  editor.addEventListener('keydown', (event) => {
    const isMod = event.ctrlKey || event.metaKey;
    if (!isMod) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undoHistory();
      return;
    }

    if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      redoHistory();
    }
  });
  editor.addEventListener('input', () => {
    pushHistory();
    syncLivePreview();
  });
  window.addEventListener('resize', syncLivePreview);

  const onSidebarMutation = () => {
    if (history.applying) {
      return;
    }

    pushHistory();
    syncLivePreview();
  };

  directionSelect.addEventListener('change', onSidebarMutation);
  fontSizeSelect.addEventListener('change', onSidebarMutation);
  densitySelect.addEventListener('change', onSidebarMutation);
  smartPaginationInput.addEventListener('change', onSidebarMutation);
  pageBorderInput.addEventListener('change', onSidebarMutation);
  pageNumbersInput.addEventListener('change', onSidebarMutation);
  codeWrapInput.addEventListener('change', onSidebarMutation);
  filenameInput.addEventListener('input', onSidebarMutation);

  pushHistory(true);
  syncLivePreview();

  return new Promise((resolve) => {
    const cleanup = () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('resize', syncLivePreview);
      if (previewTimer !== null) {
        window.clearTimeout(previewTimer);
      }
      if (previewAbort) {
        previewAbort.abort();
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };

    const close = (result: EditorExportResult | null) => {
      cleanup();
      backdrop.remove();
      resolve(result);
    };

    const cancel = () => close(null);

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        cancel();
      }
    });

    backdrop.querySelector('.mdpdf-editor-close')?.addEventListener('click', cancel);
    backdrop.querySelector('[data-action="cancel"]')?.addEventListener('click', cancel);

    backdrop.querySelector('[data-action="download"]')?.addEventListener('click', () => {
      const filename = normalizeFilename(filenameInput.value, args.filename);
      const options = readOptionsFromSidebar();

      close({
        filename,
        html: editor.innerHTML,
        options,
        saveAsDefault: saveAsDefaultInput.checked
      });
    });
  });
}

function wireToolbar(
  backdrop: HTMLElement,
  editor: HTMLElement,
  restoreSelection: () => void,
  storeSelection: () => void,
  syncLivePreview: () => void,
  undoHistory: () => void,
  redoHistory: () => void,
  pushHistory: (force?: boolean) => void
) {
  const toolbar = backdrop.querySelector('.mdpdf-editor-toolbar');
  if (!toolbar) {
    return;
  }

  const fontSelect = toolbar.querySelector<HTMLSelectElement>('select[name="fontFamily"]');
  const fontSizePxSelect = toolbar.querySelector<HTMLSelectElement>('select[name="fontSizePx"]');
  const textColorInput = toolbar.querySelector<HTMLInputElement>('input[name="textColor"]');
  const highlightColorInput = toolbar.querySelector<HTMLInputElement>('input[name="highlightColor"]');

  toolbar.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
  });

  toolbar.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;

    editor.focus();
    restoreSelection();
    ensureSelectionInEditor(editor);

    const action = button.getAttribute('data-action');
    if (action === 'undo') {
      undoHistory();
      return;
    }

    if (action === 'redo') {
      redoHistory();
      return;
    }

    const list = button.getAttribute('data-list');
    if (list === 'ul' || list === 'ol') {
      toggleList(editor, list);
      storeSelection();
      pushHistory();
      syncLivePreview();
      return;
    }

    const command = button.getAttribute('data-cmd');
    if (command) {
      document.execCommand(command, false);
      storeSelection();
      pushHistory();
      syncLivePreview();
      return;
    }

    const block = button.getAttribute('data-block');
    if (block) {
      document.execCommand('formatBlock', false, block.toUpperCase());
      storeSelection();
      pushHistory();
      syncLivePreview();
      return;
    }

    const dir = button.getAttribute('data-dir');
    if (dir === 'rtl' || dir === 'ltr') {
      setCurrentBlockDirection(editor, dir);
      storeSelection();
      pushHistory();
      syncLivePreview();
      return;
    }

    if (action === 'applyTextColor' && textColorInput) {
      applyColorCommand('foreColor', textColorInput.value);
      storeSelection();
      pushHistory();
      syncLivePreview();
      return;
    }

    if (action === 'applyHighlight' && highlightColorInput) {
      applyColorCommand('hiliteColor', highlightColorInput.value);
      storeSelection();
      pushHistory();
      syncLivePreview();
    }
  });

  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      const family = fontSelect.value;
      if (!family) return;

      editor.focus();
      restoreSelection();
      ensureSelectionInEditor(editor);
      applyInlineStyleToSelection('fontFamily', `"${family}"`);
      fontSelect.value = '';
      storeSelection();
      pushHistory();
      syncLivePreview();
    });
  }

  if (fontSizePxSelect) {
    fontSizePxSelect.addEventListener('change', () => {
      const px = Number(fontSizePxSelect.value);
      if (!Number.isFinite(px) || px < 8) return;

      editor.focus();
      restoreSelection();
      ensureSelectionInEditor(editor);
      applyInlineStyleToSelection('fontSize', `${px}px`);
      fontSizePxSelect.value = '';
      storeSelection();
      pushHistory();
      syncLivePreview();
    });
  }
}

function applyColorCommand(command: 'foreColor' | 'hiliteColor', color: string): boolean {
  const value = color.trim();
  if (!value) {
    return false;
  }

  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    // no-op
  }

  if (document.execCommand(command, false, value)) {
    return true;
  }

  if (command === 'hiliteColor' && document.execCommand('backColor', false, value)) {
    return true;
  }

  if (command === 'foreColor') {
    applyInlineStyleToSelection('color', value);
  } else {
    applyInlineStyleToSelection('backgroundColor', value);
  }

  return true;
}

function toggleList(editor: HTMLElement, listType: 'ul' | 'ol') {
  const command = listType === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
  const ok = document.execCommand(command, false);
  if (ok) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : (range.startContainer as HTMLElement);
  const block = (startNode?.closest('p,div,li') as HTMLElement | null) ?? editor;

  const listEl = document.createElement(listType);
  const li = document.createElement('li');
  li.innerHTML = block.innerHTML.trim() || '&nbsp;';
  listEl.appendChild(li);

  if (block !== editor) {
    block.replaceWith(listEl);
  } else {
    editor.appendChild(listEl);
  }

  const newRange = document.createRange();
  newRange.selectNodeContents(li);
  newRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(newRange);
}

function applyInlineStyleToSelection(styleProp: keyof CSSStyleDeclaration, value: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const span = document.createElement('span');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (span.style as any)[styleProp] = value;

  if (range.collapsed) {
    span.appendChild(document.createTextNode('\u200b'));
    range.insertNode(span);
    const nextRange = document.createRange();
    nextRange.setStart(span.firstChild ?? span, 1);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    return;
  }

  const extracted = range.extractContents();
  span.appendChild(extracted);
  range.insertNode(span);

  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  nextRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function setCurrentBlockDirection(editor: HTMLElement, dir: 'rtl' | 'ltr') {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : (range.startContainer as HTMLElement);
  const block = (startNode?.closest('p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre') as HTMLElement | null) ?? editor;

  block.setAttribute('dir', dir);
  block.style.direction = dir;
  block.style.textAlign = dir === 'rtl' ? 'right' : 'left';
}

function ensureSelectionInEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    placeCaretAtEnd(editor);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    placeCaretAtEnd(editor);
  }
}

function applyPreviewSettings(editor: HTMLElement, canvasWrap: HTMLElement, overlay: HTMLElement, options: PdfRenderOptions) {
  const resolvedDir = options.direction === 'auto' ? (rtlScript.test(editor.innerText) ? 'rtl' : 'ltr') : options.direction;
  const fontSize = mapRootFontSize(options.fontSize);
  const lineHeight = mapLineHeight(options.density);
  const topMargin = options.pageNumbers ? '16mm' : '14mm';
  const bottomMargin = options.pageNumbers ? '18mm' : '14mm';
  const borderPaddingTop = options.pageBorder ? '10mm' : '0mm';
  const borderPaddingBottom = options.pageBorder ? '11mm' : '0mm';
  const borderPaddingSides = options.pageBorder ? '10mm' : '0mm';

  canvasWrap.style.setProperty('--mdpdf-root-font-size', fontSize);
  canvasWrap.style.setProperty('--mdpdf-line-height', lineHeight);
  canvasWrap.style.setProperty('--mdpdf-page-margin-top', topMargin);
  canvasWrap.style.setProperty('--mdpdf-page-margin-bottom', bottomMargin);
  canvasWrap.style.setProperty('--mdpdf-content-extra-top', borderPaddingTop);
  canvasWrap.style.setProperty('--mdpdf-content-extra-bottom', borderPaddingBottom);
  canvasWrap.style.setProperty('--mdpdf-content-extra-inline', borderPaddingSides);
  editor.setAttribute('dir', resolvedDir);
  editor.style.direction = resolvedDir;

  canvasWrap.classList.toggle('mdpdf-show-page-border', options.pageBorder);
  canvasWrap.classList.toggle('mdpdf-show-page-numbers', options.pageNumbers);
  canvasWrap.classList.toggle('mdpdf-code-wrap', options.codeWrap);

  overlay.setAttribute('dir', resolvedDir);
}

function renderPageOverlay(editor: HTMLElement, overlay: HTMLElement, showBorder: boolean, showPageNumbers: boolean) {
  const pageHeight = 1122.52;
  const totalHeight = Math.max(editor.scrollHeight + 80, pageHeight);
  const pageCount = Math.max(1, Math.ceil(totalHeight / pageHeight));

  overlay.innerHTML = '';
  overlay.style.height = `${pageCount * pageHeight}px`;

  for (let i = 0; i < pageCount; i += 1) {
    const page = document.createElement('div');
    page.className = 'mdpdf-page-box';
    page.style.top = `${i * pageHeight}px`;

    if (showBorder) {
      const frame = document.createElement('div');
      frame.className = 'mdpdf-page-frame';
      page.appendChild(frame);
    }

    if (showPageNumbers) {
      const number = document.createElement('span');
      number.className = 'mdpdf-page-number';
      number.textContent = `${i + 1}/${pageCount}`;
      page.appendChild(number);
    }

    overlay.appendChild(page);
  }
}

function mapRootFontSize(size: PdfRenderOptions['fontSize']): string {
  if (size === 'small') return '14px';
  if (size === 'large') return '16px';
  return '15px';
}

function mapLineHeight(density: PdfRenderOptions['density']): string {
  if (density === 'compact') return '1.52';
  if (density === 'relaxed') return '1.78';
  return '1.65';
}

function normalizeDirectionValue(value: string): PdfRenderOptions['direction'] {
  if (value === 'rtl' || value === 'ltr') {
    return value;
  }

  return 'auto';
}

function normalizeFontSizeValue(value: string): PdfRenderOptions['fontSize'] {
  if (value === 'small' || value === 'large') {
    return value;
  }

  return 'medium';
}

function normalizeDensityValue(value: string): PdfRenderOptions['density'] {
  if (value === 'compact' || value === 'relaxed') {
    return value;
  }

  return 'normal';
}

function areSidebarSnapshotsEqual(current: SidebarSnapshot, next: SidebarSnapshot): boolean {
  return (
    current.filename === next.filename &&
    current.direction === next.direction &&
    current.fontSize === next.fontSize &&
    current.density === next.density &&
    current.smartPagination === next.smartPagination &&
    current.pageBorder === next.pageBorder &&
    current.pageNumbers === next.pageNumbers &&
    current.codeWrap === next.codeWrap
  );
}

function serializeSelection(root: HTMLElement): SerializedSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    return null;
  }

  return {
    startPath: getNodePath(root, range.startContainer),
    startOffset: range.startOffset,
    endPath: getNodePath(root, range.endContainer),
    endOffset: range.endOffset
  };
}

function restoreSerializedSelection(root: HTMLElement, serialized: SerializedSelection) {
  const startNode = resolveNodePath(root, serialized.startPath);
  const endNode = resolveNodePath(root, serialized.endPath);
  if (!startNode || !endNode) {
    placeCaretAtEnd(root);
    return;
  }

  const range = document.createRange();
  range.setStart(startNode, clampOffset(startNode, serialized.startOffset));
  range.setEnd(endNode, clampOffset(endNode, serialized.endOffset));

  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

function getNodePath(root: Node, target: Node): number[] {
  const path: number[] = [];
  let node: Node | null = target;
  while (node && node !== root) {
    const parentNode: Node | null = node.parentNode;
    if (!parentNode) {
      break;
    }
    path.unshift(Array.prototype.indexOf.call(parentNode.childNodes, node));
    node = parentNode;
  }
  return path;
}

function resolveNodePath(root: Node, path: number[]): Node | null {
  let node: Node = root;
  for (const index of path) {
    if (!node.childNodes[index]) {
      return null;
    }
    node = node.childNodes[index];
  }
  return node;
}

function clampOffset(node: Node, offset: number): number {
  const max = node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : node.childNodes.length;
  return Math.max(0, Math.min(max, offset));
}

function placeCaretAtEnd(root: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

async function safeTextFromResponse(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error;
    }
  } catch {
    // ignore
  }

  const text = await response.text().catch(() => '');
  return text.trim() || response.statusText || 'Unknown error';
}

export const __editorTestUtils = {
  applyPreviewSettings,
  renderPageOverlay,
  normalizeDirectionValue,
  normalizeFontSizeValue,
  normalizeDensityValue,
  areSidebarSnapshotsEqual
};

export function closeAdvancedEditor() {
  const existing = document.getElementById(EDITOR_BACKDROP_ID);
  if (existing) {
    existing.remove();
  }
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function editorUiCss(): string {
  return `
.mdpdf-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
}

.mdpdf-editor-shell {
  width: 100vw;
  height: 100vh;
  background: #eef4ff;
  color: #0f172a;
  display: grid;
  grid-template-rows: auto 1fr;
  font-family: "Segoe UI", Tahoma, sans-serif;
}

.mdpdf-editor-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid #d6e2f8;
  background: #f9fcff;
}

.mdpdf-editor-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mdpdf-editor-brand img {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid #cfe2fb;
  background: #fff;
}

.mdpdf-editor-brand h2 {
  margin: 0;
  font-size: 17px;
}

.mdpdf-editor-brand p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #334155;
}

.mdpdf-editor-close {
  border: 1px solid #c9d8f1;
  background: white;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  cursor: pointer;
}

.mdpdf-editor-main {
  display: grid;
  grid-template-columns: 1fr 320px;
  min-height: 0;
}

.mdpdf-editor-left {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 0;
  border-inline-end: 1px solid #d9e3f7;
}

.mdpdf-editor-toolbar {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid #dbe6f8;
  background: #ffffff;
}

.mdpdf-editor-toolbar button,
.mdpdf-editor-select {
  border: 1px solid #c9d8f1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font-size: 12px;
  padding: 5px 9px;
  cursor: pointer;
}

.mdpdf-editor-select {
  min-width: 126px;
}

.mdpdf-color-tool {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #c9d8f1;
  border-radius: 8px;
  background: #fff;
  padding: 3px 7px;
  font-size: 11px;
  color: #334155;
}

.mdpdf-color-tool input {
  width: 20px;
  height: 20px;
  border: none;
  padding: 0;
  background: transparent;
}

.mdpdf-editor-canvas-wrap {
  --mdpdf-page-width: 210mm;
  --mdpdf-page-height: 297mm;
  --mdpdf-root-font-size: 15px;
  --mdpdf-line-height: 1.65;
  --mdpdf-page-margin-inline: 14mm;
  --mdpdf-page-margin-top: 14mm;
  --mdpdf-page-margin-bottom: 14mm;
  --mdpdf-content-extra-top: 0mm;
  --mdpdf-content-extra-bottom: 0mm;
  --mdpdf-content-extra-inline: 0mm;
  --mdpdf-frame-inset: 7mm;
  position: relative;
  overflow: auto;
  padding: 16px;
  background: #e7eef9;
}

.mdpdf-page-overlay {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: var(--mdpdf-page-width);
  pointer-events: none;
  z-index: 1;
}

.mdpdf-page-box {
  position: absolute;
  left: 0;
  width: 100%;
  height: var(--mdpdf-page-height);
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
}

.mdpdf-page-frame {
  position: absolute;
  inset: var(--mdpdf-frame-inset);
  border: 1.4px solid #cfd8e6;
  border-radius: 8px;
  pointer-events: none;
}

.mdpdf-page-number {
  position: absolute;
  bottom: 6mm;
  right: 14mm;
  font-size: 11px;
  color: #64748b;
}

.mdpdf-page-overlay[dir="rtl"] .mdpdf-page-number {
  right: auto;
  left: 14mm;
}

.mdpdf-editor-canvas {
  position: relative;
  z-index: 2;
  width: var(--mdpdf-page-width);
  min-height: var(--mdpdf-page-height);
  margin: 0 auto;
  padding: calc(var(--mdpdf-page-margin-top) + var(--mdpdf-content-extra-top))
    calc(var(--mdpdf-page-margin-inline) + var(--mdpdf-content-extra-inline))
    calc(var(--mdpdf-page-margin-bottom) + var(--mdpdf-content-extra-bottom));
  background: transparent;
  line-height: var(--mdpdf-line-height);
  font-size: var(--mdpdf-root-font-size);
  font-family: "Vazirmatn", "BNazanin", "BYekan", "Tahoma", sans-serif;
  outline: none;
  color: #0f172a;
}

.mdpdf-editor-canvas > :first-child {
  margin-top: 0 !important;
}

.mdpdf-editor-canvas pre {
  white-space: pre;
  overflow: auto;
}

.mdpdf-editor-canvas-wrap.mdpdf-code-wrap .mdpdf-editor-canvas pre {
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}

.mdpdf-editor-right {
  padding: 14px;
  overflow: auto;
  background: #f8fbff;
  display: grid;
  align-content: start;
  gap: 9px;
}

.mdpdf-editor-right label {
  display: grid;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
}

.mdpdf-editor-right input[type="text"],
.mdpdf-editor-right select {
  border: 1px solid #c9d8f1;
  border-radius: 10px;
  padding: 8px;
  background: #fff;
}

.mdpdf-editor-check {
  display: flex !important;
  align-items: center;
  gap: 8px;
  font-weight: 500 !important;
}

.mdpdf-editor-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: #475569;
}

.mdpdf-live-preview {
  margin-top: 6px;
  border: 1px solid #d4e1f6;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.mdpdf-live-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f7;
  font-size: 12px;
}

.mdpdf-live-preview-status {
  color: #475569;
}

.mdpdf-live-preview-status.mdpdf-loading::after {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-inline-start: 6px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  border-top-color: #2563eb;
  animation: mdpdf-spin 0.85s linear infinite;
}

.mdpdf-live-preview-frame-wrap {
  height: 260px;
  background: #f8fbff;
}

.mdpdf-live-preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
}

.mdpdf-editor-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.mdpdf-secondary,
.mdpdf-primary {
  flex: 1;
  border-radius: 10px;
  border: 1px solid #c8d8f2;
  padding: 9px 10px;
  font-weight: 600;
  cursor: pointer;
}

.mdpdf-secondary {
  background: #fff;
}

.mdpdf-primary {
  color: white;
  border-color: transparent;
  background: linear-gradient(135deg, #1d4ed8, #0f766e);
}

@keyframes mdpdf-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1240px) {
  .mdpdf-editor-main {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }

  .mdpdf-editor-right {
    border-top: 1px solid #d9e3f7;
  }
}
`;
}
