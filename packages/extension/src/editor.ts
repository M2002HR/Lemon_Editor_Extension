import Quill from 'quill';
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

interface ToolbarState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  list: 'ordered' | 'bullet' | null;
  header: 2 | null;
  direction: 'rtl' | 'ltr' | null;
  color: string;
  background: string;
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

const EDITOR_BACKDROP_ID = 'mdpdf-editor-backdrop';
const BRAND_MARK_URL = chrome.runtime.getURL('branding/lemon-editor-mark-512.png');
const rtlScript = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const QUILL_SOURCE_USER = 'user';
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

let quillConfigured = false;

export function openAdvancedEditor(args: OpenEditorArgs): Promise<EditorExportResult | null> {
  closeAdvancedEditor();
  configureQuillOnce();

  const backdrop = document.createElement('div');
  backdrop.id = EDITOR_BACKDROP_ID;
  backdrop.className = 'mdpdf-editor-backdrop';

  const fontOptions = ['Tahoma', 'Vazirmatn', ...getFontFamilies()]
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
            <h2>Lemon Editor (Open Source Core: Quill)</h2>
            <p>Live preview updates in real time and final download uses same HTML/options.</p>
          </div>
        </div>
        <button type="button" class="mdpdf-editor-close" aria-label="Close">✕</button>
      </header>

      <div class="mdpdf-editor-main">
        <section class="mdpdf-editor-left">
          <div class="mdpdf-editor-toolbar" role="toolbar" aria-label="Text tools">
            <button type="button" data-action="undo" title="Undo">Undo</button>
            <button type="button" data-action="redo" title="Redo">Redo</button>
            <button type="button" data-format="bold" title="Bold"><b>B</b></button>
            <button type="button" data-format="italic" title="Italic"><i>I</i></button>
            <button type="button" data-format="underline" title="Underline"><u>U</u></button>
            <button type="button" data-list="bullet" title="Bulleted list">• List</button>
            <button type="button" data-list="ordered" title="Numbered list">1. List</button>
            <button type="button" data-header="0" title="Paragraph">P</button>
            <button type="button" data-header="2" title="Heading 2">H2</button>

            <select class="mdpdf-editor-select" name="fontFamily" title="Font family">
              <option value="">Font</option>
              ${fontOptions}
            </select>

            <select class="mdpdf-editor-select" name="fontSizePx" title="Selected text size">
              <option value="">Text size</option>
              ${FONT_SIZES.map((size) => `<option value="${size}">${size}</option>`).join('')}
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
            <button type="button" data-action="clear" title="Remove formatting">Clear</button>
          </div>

          <div class="mdpdf-editor-canvas-wrap">
            <div class="mdpdf-page-overlay"></div>
            <div class="mdpdf-quill-shell">
              <div class="mdpdf-editor-canvas"></div>
            </div>
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

          <p class="mdpdf-editor-note">Editor uses Quill open-source engine. Live preview is rendered by the same PDF service as download.</p>

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

  const editorHost = backdrop.querySelector<HTMLElement>('.mdpdf-editor-canvas');
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
    !editorHost ||
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

  directionSelect.value = args.options.direction;
  fontSizeSelect.value = args.options.fontSize;
  densitySelect.value = args.options.density;
  smartPaginationInput.checked = args.options.smartPagination;
  pageBorderInput.checked = args.options.pageBorder;
  pageNumbersInput.checked = args.options.pageNumbers;
  codeWrapInput.checked = args.options.codeWrap;

  const quill = new Quill(editorHost, {
    modules: {
      history: {
        delay: 500,
        maxStack: 300,
        userOnly: false
      },
      toolbar: false
    }
  });

  quill.clipboard.dangerouslyPasteHTML(args.html || '<p><br></p>', QUILL_SOURCE_USER);
  quill.history.clear();

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

  const sidebarHistory: SidebarSnapshot[] = [readSidebarSnapshot()];
  let sidebarHistoryIndex = 0;
  let syncingSidebarHistory = false;

  let previewTimer: number | null = null;
  let previewAbort: AbortController | null = null;
  let previewUrl: string | null = null;

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

  const syncPreviewLayout = () => {
    const options = readOptionsFromSidebar();
    applyPreviewSettings(quill.root, canvasWrap, overlay, options);
    renderPageOverlay(quill.root, overlay, options.pageBorder, options.pageNumbers);
  };

  const syncLivePreview = () => {
    syncPreviewLayout();
    schedulePdfPreview();
  };

  const updatePdfPreview = async () => {
    const options = readOptionsFromSidebar();
    const payload = {
      html: quill.root.innerHTML,
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

  const onSidebarMutation = () => {
    if (!syncingSidebarHistory) {
      pushSidebarHistory(sidebarHistory, () => sidebarHistoryIndex, (next) => {
        sidebarHistoryIndex = next;
      }, readSidebarSnapshot);
    }

    syncLivePreview();
  };

  const applySidebarSnapshot = (snapshot: SidebarSnapshot) => {
    syncingSidebarHistory = true;
    filenameInput.value = snapshot.filename;
    directionSelect.value = snapshot.direction;
    fontSizeSelect.value = snapshot.fontSize;
    densitySelect.value = snapshot.density;
    smartPaginationInput.checked = snapshot.smartPagination;
    pageBorderInput.checked = snapshot.pageBorder;
    pageNumbersInput.checked = snapshot.pageNumbers;
    codeWrapInput.checked = snapshot.codeWrap;
    syncingSidebarHistory = false;
  };

  const setToolbarState = () => {
    const format = quill.getFormat();

    const state: ToolbarState = {
      isBold: format.bold === true,
      isItalic: format.italic === true,
      isUnderline: format.underline === true,
      list: format.list === 'ordered' || format.list === 'bullet' ? format.list : null,
      header: format.header === 2 ? 2 : null,
      direction: format.direction === 'rtl' ? 'rtl' : format.direction === 'ltr' ? 'ltr' : null,
      color: typeof format.color === 'string' ? normalizeHexColor(format.color) : '#0f172a',
      background: typeof format.background === 'string' ? normalizeHexColor(format.background) : '#fff59d'
    };

    backdrop.querySelectorAll<HTMLButtonElement>('.mdpdf-editor-toolbar button').forEach((button) => {
      const active =
        (button.getAttribute('data-format') === 'bold' && state.isBold) ||
        (button.getAttribute('data-format') === 'italic' && state.isItalic) ||
        (button.getAttribute('data-format') === 'underline' && state.isUnderline) ||
        (button.getAttribute('data-list') === state.list) ||
        (button.getAttribute('data-header') === '2' && state.header === 2) ||
        (button.getAttribute('data-header') === '0' && state.header === null) ||
        (button.getAttribute('data-dir') === state.direction);

      button.classList.toggle('mdpdf-active', active);
    });

    const textColor = backdrop.querySelector<HTMLInputElement>('input[name="textColor"]');
    const highlightColor = backdrop.querySelector<HTMLInputElement>('input[name="highlightColor"]');
    if (textColor) {
      textColor.value = state.color;
    }
    if (highlightColor) {
      highlightColor.value = state.background;
    }
  };

  wireToolbar(backdrop, quill, syncLivePreview, onSidebarMutation, setToolbarState, () => {
    if (sidebarHistoryIndex <= 0) {
      quill.history.undo();
      return;
    }

    sidebarHistoryIndex -= 1;
    applySidebarSnapshot(sidebarHistory[sidebarHistoryIndex] as SidebarSnapshot);
    quill.history.undo();
    syncLivePreview();
  }, () => {
    if (sidebarHistoryIndex >= sidebarHistory.length - 1) {
      quill.history.redo();
      return;
    }

    sidebarHistoryIndex += 1;
    applySidebarSnapshot(sidebarHistory[sidebarHistoryIndex] as SidebarSnapshot);
    quill.history.redo();
    syncLivePreview();
  });

  const onTextChange = () => {
    setToolbarState();
    syncLivePreview();
  };

  const onSelectionChange = () => {
    setToolbarState();
  };

  quill.on('text-change', onTextChange);
  quill.on('selection-change', onSelectionChange);

  window.addEventListener('resize', syncPreviewLayout);
  directionSelect.addEventListener('change', onSidebarMutation);
  fontSizeSelect.addEventListener('change', onSidebarMutation);
  densitySelect.addEventListener('change', onSidebarMutation);
  smartPaginationInput.addEventListener('change', onSidebarMutation);
  pageBorderInput.addEventListener('change', onSidebarMutation);
  pageNumbersInput.addEventListener('change', onSidebarMutation);
  codeWrapInput.addEventListener('change', onSidebarMutation);
  filenameInput.addEventListener('input', onSidebarMutation);

  quill.focus();
  setToolbarState();
  syncLivePreview();

  return new Promise((resolve) => {
    const cleanup = () => {
      window.removeEventListener('resize', syncPreviewLayout);
      quill.off('text-change', onTextChange);
      quill.off('selection-change', onSelectionChange);

      directionSelect.removeEventListener('change', onSidebarMutation);
      fontSizeSelect.removeEventListener('change', onSidebarMutation);
      densitySelect.removeEventListener('change', onSidebarMutation);
      smartPaginationInput.removeEventListener('change', onSidebarMutation);
      pageBorderInput.removeEventListener('change', onSidebarMutation);
      pageNumbersInput.removeEventListener('change', onSidebarMutation);
      codeWrapInput.removeEventListener('change', onSidebarMutation);
      filenameInput.removeEventListener('input', onSidebarMutation);

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

    backdrop.addEventListener('keydown', (event) => {
      const isMod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
        return;
      }

      if (isMod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        quill.history.undo();
        syncLivePreview();
        return;
      }

      if (isMod && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        quill.history.redo();
        syncLivePreview();
      }
    });

    backdrop.querySelector('.mdpdf-editor-close')?.addEventListener('click', cancel);
    backdrop.querySelector('[data-action="cancel"]')?.addEventListener('click', cancel);

    backdrop.querySelector('[data-action="download"]')?.addEventListener('click', () => {
      const filename = normalizeFilename(filenameInput.value, args.filename);
      const options = readOptionsFromSidebar();
      const html = stripQuillArtifacts(quill.root.innerHTML);

      close({
        filename,
        html,
        options,
        saveAsDefault: saveAsDefaultInput.checked
      });
    });
  });
}

function configureQuillOnce() {
  if (quillConfigured) {
    return;
  }

  const families = ['Tahoma', 'Vazirmatn', ...getFontFamilies()];

  const FontStyle = Quill.import('attributors/style/font') as { whitelist: string[] };
  FontStyle.whitelist = families;
  Quill.register('attributors/style/font', FontStyle, true);

  const SizeStyle = Quill.import('attributors/style/size') as { whitelist: string[] };
  SizeStyle.whitelist = FONT_SIZES;
  Quill.register('attributors/style/size', SizeStyle, true);

  quillConfigured = true;
}

function wireToolbar(
  backdrop: HTMLElement,
  quill: Quill,
  syncLivePreview: () => void,
  onSidebarMutation: () => void,
  setToolbarState: () => void,
  undoAction: () => void,
  redoAction: () => void
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
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-action');
    if (action === 'undo') {
      undoAction();
      setToolbarState();
      return;
    }

    if (action === 'redo') {
      redoAction();
      setToolbarState();
      return;
    }

    const format = button.getAttribute('data-format');
    if (format === 'bold' || format === 'italic' || format === 'underline') {
      toggleInlineFormat(quill, format);
      setToolbarState();
      syncLivePreview();
      return;
    }

    const list = button.getAttribute('data-list');
    if (list === 'ordered' || list === 'bullet') {
      toggleListFormat(quill, list);
      setToolbarState();
      syncLivePreview();
      return;
    }

    const headerValue = button.getAttribute('data-header');
    if (headerValue === '0' || headerValue === '2') {
      setHeaderFormat(quill, Number(headerValue));
      setToolbarState();
      syncLivePreview();
      return;
    }

    const dir = button.getAttribute('data-dir');
    if (dir === 'rtl' || dir === 'ltr') {
      setDirectionForLine(quill, dir);
      setToolbarState();
      syncLivePreview();
      return;
    }

    if (action === 'applyTextColor' && textColorInput) {
      quill.focus();
      quill.format('color', textColorInput.value, QUILL_SOURCE_USER);
      syncLivePreview();
      return;
    }

    if (action === 'applyHighlight' && highlightColorInput) {
      quill.focus();
      quill.format('background', highlightColorInput.value, QUILL_SOURCE_USER);
      syncLivePreview();
      return;
    }

    if (action === 'clear') {
      clearFormatting(quill);
      setToolbarState();
      syncLivePreview();
    }
  });

  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      if (!fontSelect.value) {
        return;
      }

      quill.focus();
      quill.format('font', fontSelect.value, QUILL_SOURCE_USER);
      fontSelect.value = '';
      setToolbarState();
      syncLivePreview();
    });
  }

  if (fontSizePxSelect) {
    fontSizePxSelect.addEventListener('change', () => {
      if (!fontSizePxSelect.value) {
        return;
      }

      quill.focus();
      quill.format('size', fontSizePxSelect.value, QUILL_SOURCE_USER);
      fontSizePxSelect.value = '';
      setToolbarState();
      syncLivePreview();
    });
  }

  backdrop.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.mdpdf-editor-right input, .mdpdf-editor-right select').forEach((item) => {
    item.addEventListener('change', onSidebarMutation);
  });
}

function toggleInlineFormat(quill: Quill, format: 'bold' | 'italic' | 'underline') {
  const current = quill.getFormat();
  const enabled = current[format] === true;
  quill.focus();
  quill.format(format, !enabled, QUILL_SOURCE_USER);
}

function toggleListFormat(quill: Quill, value: 'ordered' | 'bullet') {
  const format = quill.getFormat();
  const next = format.list === value ? false : value;
  quill.focus();
  quill.format('list', next, QUILL_SOURCE_USER);
}

function setHeaderFormat(quill: Quill, value: number) {
  const format = quill.getFormat();
  const isActive = format.header === value;
  quill.focus();
  quill.format('header', isActive || value === 0 ? false : value, QUILL_SOURCE_USER);
}

function clearFormatting(quill: Quill) {
  const range = quill.getSelection(true);
  if (!range) {
    return;
  }

  if (range.length > 0) {
    quill.removeFormat(range.index, range.length, QUILL_SOURCE_USER);
    return;
  }

  quill.format('bold', false, QUILL_SOURCE_USER);
  quill.format('italic', false, QUILL_SOURCE_USER);
  quill.format('underline', false, QUILL_SOURCE_USER);
  quill.format('color', false, QUILL_SOURCE_USER);
  quill.format('background', false, QUILL_SOURCE_USER);
  quill.format('size', false, QUILL_SOURCE_USER);
  quill.format('font', false, QUILL_SOURCE_USER);
}

function setDirectionForLine(quill: Quill, dir: 'rtl' | 'ltr') {
  const range = quill.getSelection(true);
  if (!range) {
    return;
  }

  const length = Math.max(range.length, 1);
  quill.formatLine(range.index, length, 'direction', dir === 'rtl' ? 'rtl' : false, QUILL_SOURCE_USER);
  quill.formatLine(range.index, length, 'align', dir === 'rtl' ? 'right' : false, QUILL_SOURCE_USER);
}

function pushSidebarHistory(
  history: SidebarSnapshot[],
  getIndex: () => number,
  setIndex: (next: number) => void,
  readSnapshot: () => SidebarSnapshot
) {
  const snapshot = readSnapshot();
  const current = history[getIndex()];
  if (current && areSidebarSnapshotsEqual(current, snapshot)) {
    return;
  }

  history.splice(getIndex() + 1);
  history.push(snapshot);
  if (history.length > 120) {
    history.shift();
  }

  setIndex(history.length - 1);
}

function applyPreviewSettings(root: HTMLElement, canvasWrap: HTMLElement, overlay: HTMLElement, options: PdfRenderOptions) {
  const resolvedDir = options.direction === 'auto' ? (rtlScript.test(root.innerText) ? 'rtl' : 'ltr') : options.direction;
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

  root.setAttribute('dir', resolvedDir);
  root.style.direction = resolvedDir;

  canvasWrap.classList.toggle('mdpdf-code-wrap', options.codeWrap);
  overlay.setAttribute('dir', resolvedDir);
}

function renderPageOverlay(root: HTMLElement, overlay: HTMLElement, showBorder: boolean, showPageNumbers: boolean) {
  const pageHeight = 1122.52;
  const totalHeight = Math.max(root.scrollHeight + 80, pageHeight);
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

function stripQuillArtifacts(html: string): string {
  const cleaned = html
    .replace(/ class="ql-align-(right|center|justify)"/g, '')
    .replace(/ class="ql-direction-rtl"/g, '')
    .replace(/<p><br><\/p>/g, '<p></p>');

  return cleaned.trim();
}

function normalizeHexColor(color: string): string {
  if (!color) {
    return '#0f172a';
  }

  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toLowerCase();
  }

  const temp = document.createElement('span');
  temp.style.color = color;
  document.body.appendChild(temp);
  const value = getComputedStyle(temp).color;
  temp.remove();

  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return '#0f172a';
  }

  const r = Number(match[1]).toString(16).padStart(2, '0');
  const g = Number(match[2]).toString(16).padStart(2, '0');
  const b = Number(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
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

.mdpdf-editor-toolbar button.mdpdf-active {
  border-color: #3b82f6;
  background: #eaf2ff;
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
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
}

.mdpdf-page-frame {
  position: absolute;
  inset: var(--mdpdf-frame-inset);
  border: 1.4px solid #cfd8e6;
  border-radius: 8px;
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

.mdpdf-quill-shell {
  position: relative;
  z-index: 2;
  width: var(--mdpdf-page-width);
  min-height: var(--mdpdf-page-height);
  margin: 0 auto;
  background: transparent;
}

.mdpdf-quill-shell .ql-container {
  border: none;
  font-family: "Vazirmatn", "BNazanin", "BYekan", "Tahoma", sans-serif;
  font-size: var(--mdpdf-root-font-size);
  line-height: var(--mdpdf-line-height);
}

.mdpdf-quill-shell .ql-editor {
  min-height: var(--mdpdf-page-height);
  padding: calc(var(--mdpdf-page-margin-top) + var(--mdpdf-content-extra-top))
    calc(var(--mdpdf-page-margin-inline) + var(--mdpdf-content-extra-inline))
    calc(var(--mdpdf-page-margin-bottom) + var(--mdpdf-content-extra-bottom));
  color: #0f172a;
  white-space: normal;
}

.mdpdf-editor-canvas,
.mdpdf-quill-shell .ql-editor {
  outline: none;
}

.mdpdf-quill-shell .ql-editor p,
.mdpdf-quill-shell .ql-editor ul,
.mdpdf-quill-shell .ql-editor ol,
.mdpdf-quill-shell .ql-editor pre,
.mdpdf-quill-shell .ql-editor table,
.mdpdf-quill-shell .ql-editor blockquote {
  margin: 0 0 1em;
}

.mdpdf-quill-shell .ql-editor pre {
  white-space: pre;
  overflow: auto;
}

.mdpdf-editor-canvas-wrap.mdpdf-code-wrap .ql-editor pre {
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
  color: #fff;
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
