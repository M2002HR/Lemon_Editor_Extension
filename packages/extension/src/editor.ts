import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { FontSize } from '@tiptap/extension-text-style/font-size';
import { Color } from '@tiptap/extension-text-style/color';
import { BackgroundColor } from '@tiptap/extension-text-style/background-color';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { buildDefaultFilename } from './content/dom.js';
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
const FLATICON_UI_CSS_URL = chrome.runtime.getURL('uicons/regular/rounded.css');
const FLATICON_UI_LINK_ID = 'mdpdf-flaticon-uicons-css';
const rtlScript = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const FONT_SIZE_OPTIONS = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

export function openAdvancedEditor(args: OpenEditorArgs): Promise<EditorExportResult | null> {
  closeAdvancedEditor();
  ensureFlaticonUiIconsLoaded();

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
            <h2>Lemon Editor (Open Source: Tiptap)</h2>
            <p>Initial content is normalized into editor document model, then edited as rich content.</p>
          </div>
        </div>
        <div class="mdpdf-topbar-actions">
          <label class="mdpdf-topbar-field" title="Output file name">
            <i class="fi fi-rr-file"></i>
            <input name="filename" type="text" value="${escapeAttribute(args.filename || buildDefaultFilename())}" />
          </label>
          <label class="mdpdf-option-chip mdpdf-option-chip-top" title="Save these options as default">
            <input type="checkbox" name="saveAsDefault" />
            <i class="fi fi-rr-disk"></i>
            <span>Save Default</span>
          </label>
          <button type="button" class="mdpdf-secondary" data-action="cancel" title="Cancel editor">
            <i class="fi fi-rr-cross-small"></i><span>Cancel</span>
          </button>
          <button type="button" class="mdpdf-primary" data-action="download" title="Download final PDF">
            <i class="fi fi-rr-download"></i><span>Download PDF</span>
          </button>
          <button type="button" class="mdpdf-editor-close" aria-label="Close" title="Close editor">✕</button>
        </div>
      </header>

      <div class="mdpdf-editor-main">
        <section class="mdpdf-editor-left">
          <div class="mdpdf-editor-toolbar" role="toolbar" aria-label="Text tools">
            <datalist id="mdpdf-font-list">
              ${fontOptions}
            </datalist>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">History</span>
              <div class="mdpdf-tool-items">
                <button type="button" data-action="undo" title="Undo"><i class="fi-rr-undo"></i><span>Undo</span></button>
                <button type="button" data-action="redo" title="Redo"><i class="fi-rr-redo"></i><span>Redo</span></button>
              </div>
            </div>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">Text</span>
              <div class="mdpdf-tool-items">
                <button type="button" data-action="bold" title="Bold"><i class="fi-rr-bold"></i><span>Bold</span></button>
                <button type="button" data-action="italic" title="Italic"><i class="fi-rr-italic"></i><span>Italic</span></button>
                <button type="button" data-action="underline" title="Underline"><i class="fi-rr-underline"></i><span>Underline</span></button>
                <button type="button" data-action="strike" title="Strike"><i class="fi-rr-text-slash"></i><span>Strike</span></button>
                <button type="button" data-action="code" title="Inline code"><i class="fi-rr-code-simple"></i><span>Code</span></button>
              </div>
            </div>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">Blocks</span>
              <div class="mdpdf-tool-items">
                <button type="button" data-action="paragraph" title="Paragraph"><i class="fi-rr-paragraph"></i><span>P</span></button>
                <button type="button" data-action="h1" title="Heading 1"><i class="fi-rr-heading"></i><span>H1</span></button>
                <button type="button" data-action="h2" title="Heading 2"><i class="fi-rr-heading"></i><span>H2</span></button>
                <button type="button" data-action="h3" title="Heading 3"><i class="fi-rr-heading"></i><span>H3</span></button>
                <button type="button" data-action="blockquote" title="Quote"><i class="fi-rr-quote-right"></i><span>Quote</span></button>
                <button type="button" data-action="codeblock" title="Code block"><i class="fi-rr-code-branch"></i><span>Code block</span></button>
              </div>
            </div>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">Lists</span>
              <div class="mdpdf-tool-items">
                <button type="button" data-action="bulletList" title="Bullet list"><i class="fi-rr-list"></i><span>Bullet</span></button>
                <button type="button" data-action="orderedList" title="Numbered list"><i class="fi-rr-list-check"></i><span>Number</span></button>
                <button type="button" data-action="taskList" title="Task list"><i class="fi-rr-checklist-task-budget"></i><span>Task</span></button>
              </div>
            </div>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">Align & Dir</span>
              <div class="mdpdf-tool-items">
                <button type="button" data-action="alignLeft" title="Align left"><i class="fi-rr-align-left"></i><span>Left</span></button>
                <button type="button" data-action="alignCenter" title="Align center"><i class="fi-rr-align-center"></i><span>Center</span></button>
                <button type="button" data-action="alignRight" title="Align right"><i class="fi-rr-align-left mdpdf-icon-flip"></i><span>Right</span></button>
                <button type="button" data-action="alignJustify" title="Justify"><i class="fi-rr-align-justify"></i><span>Justify</span></button>
                <button type="button" data-action="rtl" title="Right to left line"><i class="fi-rr-text-width"></i><span>RTL</span></button>
                <button type="button" data-action="ltr" title="Left to right line"><i class="fi-rr-text-width mdpdf-icon-flip"></i><span>LTR</span></button>
              </div>
            </div>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">PDF Layout</span>
              <div class="mdpdf-tool-items">
                <label class="mdpdf-inline-control" title="Text direction in PDF">
                  <i class="fi fi-rr-text-width"></i>
                  <select class="mdpdf-editor-select" name="direction">
                    <option value="auto">Direction: Auto</option>
                    <option value="rtl">Direction: RTL</option>
                    <option value="ltr">Direction: LTR</option>
                  </select>
                </label>
                <label class="mdpdf-inline-control" title="Base font size in PDF">
                  <i class="fi fi-rr-text-size"></i>
                  <select class="mdpdf-editor-select" name="fontSize">
                    <option value="small">Size: Small</option>
                    <option value="medium">Size: Medium</option>
                    <option value="large">Size: Large</option>
                  </select>
                </label>
                <label class="mdpdf-inline-control" title="Line spacing density in PDF">
                  <i class="fi fi-rr-layers"></i>
                  <select class="mdpdf-editor-select" name="density">
                    <option value="compact">Density: Compact</option>
                    <option value="normal">Density: Normal</option>
                    <option value="relaxed">Density: Relaxed</option>
                  </select>
                </label>
                <label class="mdpdf-option-chip" title="Keep headings and blocks from awkward page breaks">
                  <input type="checkbox" name="smartPagination" />
                  <i class="fi fi-rr-calendar-check"></i>
                  <span>Smart Pagination</span>
                </label>
                <label class="mdpdf-option-chip" title="Draw border in each PDF page">
                  <input type="checkbox" name="pageBorder" />
                  <i class="fi fi-rr-border-all"></i>
                  <span>Page Border</span>
                </label>
                <label class="mdpdf-option-chip" title="Show page numbers">
                  <input type="checkbox" name="pageNumbers" />
                  <i class="fi fi-rr-list-check"></i>
                  <span>Page Numbers</span>
                </label>
                <label class="mdpdf-option-chip" title="Wrap long code lines in output">
                  <input type="checkbox" name="codeWrap" />
                  <i class="fi fi-rr-paragraph-left"></i>
                  <span>Code Wrap</span>
                </label>
              </div>
            </div>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">Font & Color</span>
              <div class="mdpdf-tool-items">
                <label class="mdpdf-font-search-wrap" title="Search and apply font">
                  <i class="fi-rr-book-font"></i>
                  <input class="mdpdf-editor-select mdpdf-font-search" name="fontFamilySearch" list="mdpdf-font-list" placeholder="Search font..." />
                </label>
                <select class="mdpdf-editor-select" name="fontSizePx" title="Selected text size">
                  <option value="">Text size</option>
                  ${FONT_SIZE_OPTIONS.map((size) => `<option value="${size}">${size}</option>`).join('')}
                </select>
                <label class="mdpdf-color-tool" title="Text color">
                  <i class="fi-rr-palette"></i>
                  <span>Text</span>
                  <input type="color" name="textColor" value="#0f172a" />
                </label>
                <label class="mdpdf-color-tool" title="Background color">
                  <i class="fi-rr-highlighter"></i>
                  <span>Mark</span>
                  <input type="color" name="highlightColor" value="#fff59d" />
                </label>
                <button type="button" data-action="applyTextColor" title="Apply text color"><i class="fi-rr-paint-brush"></i><span>Apply text</span></button>
                <button type="button" data-action="applyHighlight" title="Apply highlight"><i class="fi-rr-highlighter-line"></i><span>Apply mark</span></button>
              </div>
            </div>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">Insert</span>
              <div class="mdpdf-tool-items">
                <button type="button" data-action="setLink" title="Set link"><i class="fi-rr-link"></i><span>Link</span></button>
                <button type="button" data-action="unsetLink" title="Unset link"><i class="fi-rr-link-slash"></i><span>Unlink</span></button>
                <button type="button" data-action="insertImage" title="Insert image by URL"><i class="fi-rr-images"></i><span>Image</span></button>
                <button type="button" data-action="insertTable" title="Insert table"><i class="fi-rr-table-columns"></i><span>Table</span></button>
                <button type="button" data-action="addRowAfter" title="Add row"><i class="fi-rr-add"></i><span>+Row</span></button>
                <button type="button" data-action="addColumnAfter" title="Add column"><i class="fi-rr-add"></i><span>+Col</span></button>
                <button type="button" data-action="mergeCells" title="Merge cells"><i class="fi-rr-table-layout"></i><span>Merge</span></button>
                <button type="button" data-action="splitCell" title="Split cells"><i class="fi-rr-table-rows"></i><span>Split</span></button>
                <button type="button" data-action="deleteTable" title="Delete table"><i class="fi-rr-trash"></i><span>Delete table</span></button>
              </div>
            </div>

            <div class="mdpdf-tool-group">
              <span class="mdpdf-tool-title">Advanced</span>
              <div class="mdpdf-tool-items">
                <button type="button" data-action="subscript" title="Subscript"><i class="fi-rr-subscript"></i><span>Sub</span></button>
                <button type="button" data-action="superscript" title="Superscript"><i class="fi-rr-superscript"></i><span>Sup</span></button>
                <button type="button" data-action="clear" title="Clear formatting"><i class="fi-rr-eraser"></i><span>Clear</span></button>
              </div>
            </div>
          </div>

          <div class="mdpdf-context-menu" hidden>
            <div class="mdpdf-context-menu-header">Quick Actions</div>
            <div class="mdpdf-context-menu-row">
              <button type="button" data-context-action="bold"><i class="fi-rr-bold"></i></button>
              <button type="button" data-context-action="italic"><i class="fi-rr-italic"></i></button>
              <button type="button" data-context-action="underline"><i class="fi-rr-underline"></i></button>
              <button type="button" data-context-action="highlight"><i class="fi-rr-highlighter-line"></i></button>
            </div>
            <div class="mdpdf-context-menu-row">
              <label>
                <span>Font</span>
                <input name="contextFontFamilySearch" list="mdpdf-font-list" placeholder="Search font..." />
              </label>
            </div>
            <div class="mdpdf-context-menu-row">
              <label>
                <span>Text</span>
                <input type="color" name="contextTextColor" value="#0f172a" />
              </label>
              <label>
                <span>Mark</span>
                <input type="color" name="contextHighlightColor" value="#fff59d" />
              </label>
            </div>
          </div>

          <div class="mdpdf-editor-canvas-wrap">
            <div class="mdpdf-page-overlay"></div>
            <div class="mdpdf-editor-canvas"></div>
          </div>
        </section>

      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const editorContainer = backdrop.querySelector<HTMLElement>('.mdpdf-editor-canvas');
  const contextMenu = backdrop.querySelector<HTMLElement>('.mdpdf-context-menu');
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

  if (
    !editorContainer ||
    !contextMenu ||
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
    !saveAsDefaultInput
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

  const initialNormalizedHtml = normalizeSourceHtmlForEditor(args.html);

  const editor = new Editor({
    element: editorContainer,
    textDirection: 'auto',
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https'
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      BackgroundColor,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify']
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({
        resizable: false,
        allowTableNodeSelection: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      Subscript,
      Superscript
    ],
    content: initialNormalizedHtml,
    editorProps: {
      attributes: {
        class: 'mdpdf-tiptap'
      }
    }
  });

  const getEditorRoot = () => editor.view.dom as HTMLElement;

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
  let applyingSidebarHistory = false;

  const syncPreviewLayout = () => {
    const options = readOptionsFromSidebar();
    const root = getEditorRoot();
    applyPreviewSettings(root, canvasWrap, overlay, options);
    renderPageOverlay(root, overlay, options.pageBorder, options.pageNumbers);
  };

  const syncLivePreview = () => {
    syncPreviewLayout();
  };

  const pushSidebarHistory = () => {
    if (applyingSidebarHistory) {
      return;
    }

    const snapshot = readSidebarSnapshot();
    const current = sidebarHistory[sidebarHistoryIndex];
    if (current && areSidebarSnapshotsEqual(current, snapshot)) {
      return;
    }

    sidebarHistory.splice(sidebarHistoryIndex + 1);
    sidebarHistory.push(snapshot);

    if (sidebarHistory.length > 120) {
      sidebarHistory.shift();
    }

    sidebarHistoryIndex = sidebarHistory.length - 1;
  };

  const applySidebarSnapshot = (snapshot: SidebarSnapshot) => {
    applyingSidebarHistory = true;
    filenameInput.value = snapshot.filename;
    directionSelect.value = snapshot.direction;
    fontSizeSelect.value = snapshot.fontSize;
    densitySelect.value = snapshot.density;
    smartPaginationInput.checked = snapshot.smartPagination;
    pageBorderInput.checked = snapshot.pageBorder;
    pageNumbersInput.checked = snapshot.pageNumbers;
    codeWrapInput.checked = snapshot.codeWrap;
    applyingSidebarHistory = false;
  };

  const setActiveStates = () => {
    const state = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      blockquote: editor.isActive('blockquote'),
      codeblock: editor.isActive('codeBlock'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      taskList: editor.isActive('taskList'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 })
    };

    backdrop.querySelectorAll<HTMLButtonElement>('.mdpdf-editor-toolbar button').forEach((button) => {
      const action = button.getAttribute('data-action');
      if (!action) {
        button.classList.remove('mdpdf-active');
        return;
      }

      const active = Boolean((state as Record<string, boolean>)[action]);
      button.classList.toggle('mdpdf-active', active);
    });

    const textColorInput = backdrop.querySelector<HTMLInputElement>('input[name="textColor"]');
    const highlightColorInput = backdrop.querySelector<HTMLInputElement>('input[name="highlightColor"]');
    const fontFamilySearch = backdrop.querySelector<HTMLInputElement>('input[name="fontFamilySearch"]');
    const fontSizePxSelect = backdrop.querySelector<HTMLSelectElement>('select[name="fontSizePx"]');

    const attrs = editor.getAttributes('textStyle') as {
      color?: string | null;
      backgroundColor?: string | null;
      fontFamily?: string | null;
      fontSize?: string | null;
    };

    if (textColorInput && attrs.color) {
      textColorInput.value = normalizeHexColor(attrs.color);
    }

    if (highlightColorInput && attrs.backgroundColor) {
      highlightColorInput.value = normalizeHexColor(attrs.backgroundColor);
    }

    if (fontFamilySearch) {
      fontFamilySearch.value = attrs.fontFamily ?? '';
    }

    if (fontSizePxSelect) {
      fontSizePxSelect.value = attrs.fontSize ?? '';
    }
  };

  const onSidebarMutation = () => {
    pushSidebarHistory();
    syncLivePreview();
  };

  wireToolbar(backdrop, editor, setActiveStates, syncLivePreview, () => {
    if (sidebarHistoryIndex > 0) {
      sidebarHistoryIndex -= 1;
      applySidebarSnapshot(sidebarHistory[sidebarHistoryIndex] as SidebarSnapshot);
    }
    editor.commands.undo();
    syncLivePreview();
  }, () => {
    if (sidebarHistoryIndex < sidebarHistory.length - 1) {
      sidebarHistoryIndex += 1;
      applySidebarSnapshot(sidebarHistory[sidebarHistoryIndex] as SidebarSnapshot);
    }
    editor.commands.redo();
    syncLivePreview();
  });

  const cleanupContextMenu = wireContextMenu(backdrop, editor, setActiveStates, syncLivePreview);

  editor.on('update', () => {
    setActiveStates();
    syncLivePreview();
  });

  editor.on('selectionUpdate', () => {
    setActiveStates();
  });

  window.addEventListener('resize', syncPreviewLayout);
  directionSelect.addEventListener('change', onSidebarMutation);
  fontSizeSelect.addEventListener('change', onSidebarMutation);
  densitySelect.addEventListener('change', onSidebarMutation);
  smartPaginationInput.addEventListener('change', onSidebarMutation);
  pageBorderInput.addEventListener('change', onSidebarMutation);
  pageNumbersInput.addEventListener('change', onSidebarMutation);
  codeWrapInput.addEventListener('change', onSidebarMutation);
  filenameInput.addEventListener('input', onSidebarMutation);

  backdrop.addEventListener('keydown', (event) => {
    const isMod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (event.key === 'Escape') {
      event.preventDefault();
      backdrop.querySelector<HTMLElement>('[data-action="cancel"]')?.click();
      return;
    }

    if (isMod && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      editor.commands.undo();
      syncLivePreview();
      return;
    }

    if (isMod && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault();
      editor.commands.redo();
      syncLivePreview();
    }
  });

  editor.commands.focus('end');
  setActiveStates();
  syncLivePreview();

  return new Promise((resolve) => {
    const cleanup = () => {
      window.removeEventListener('resize', syncPreviewLayout);
      directionSelect.removeEventListener('change', onSidebarMutation);
      fontSizeSelect.removeEventListener('change', onSidebarMutation);
      densitySelect.removeEventListener('change', onSidebarMutation);
      smartPaginationInput.removeEventListener('change', onSidebarMutation);
      pageBorderInput.removeEventListener('change', onSidebarMutation);
      pageNumbersInput.removeEventListener('change', onSidebarMutation);
      codeWrapInput.removeEventListener('change', onSidebarMutation);
      filenameInput.removeEventListener('input', onSidebarMutation);

      cleanupContextMenu();
      editor.destroy();
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
        html: buildExportHtml(editor),
        options,
        saveAsDefault: saveAsDefaultInput.checked
      });
    });
  });
}

function wireToolbar(
  backdrop: HTMLElement,
  editor: Editor,
  setActiveStates: () => void,
  syncLivePreview: () => void,
  undoAction: () => void,
  redoAction: () => void
) {
  const toolbar = backdrop.querySelector('.mdpdf-editor-toolbar');
  if (!toolbar) {
    return;
  }

  toolbar.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
  });

  const getColor = (name: 'textColor' | 'highlightColor', fallback: string): string => {
    const input = toolbar.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    return input?.value || fallback;
  };

  toolbar.addEventListener('click', () => {
    editor.commands.focus();
  });

  toolbar.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-action');
    if (!action) {
      return;
    }

    switch (action) {
      case 'undo':
        undoAction();
        break;
      case 'redo':
        redoAction();
        break;
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'strike':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'code':
        editor.chain().focus().toggleCode().run();
        break;
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'h3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'codeblock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'taskList':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'alignLeft':
        editor.chain().focus().setTextAlign('left').run();
        break;
      case 'alignCenter':
        editor.chain().focus().setTextAlign('center').run();
        break;
      case 'alignRight':
        editor.chain().focus().setTextAlign('right').run();
        break;
      case 'alignJustify':
        editor.chain().focus().setTextAlign('justify').run();
        break;
      case 'rtl':
        editor.chain().focus().setTextDirection('rtl').setTextAlign('right').run();
        break;
      case 'ltr':
        editor.chain().focus().setTextDirection('ltr').setTextAlign('left').run();
        break;
      case 'applyTextColor':
        editor.chain().focus().setColor(getColor('textColor', '#0f172a')).run();
        break;
      case 'applyHighlight':
        editor.chain().focus().setBackgroundColor(getColor('highlightColor', '#fff59d')).run();
        break;
      case 'setLink': {
        const previous = editor.getAttributes('link').href as string | undefined;
        const href = window.prompt('Enter URL', previous || 'https://');
        if (href === null) {
          break;
        }

        const normalized = href.trim();
        if (!normalized) {
          editor.chain().focus().unsetLink().run();
        } else {
          editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
        }
        break;
      }
      case 'unsetLink':
        editor.chain().focus().unsetLink().run();
        break;
      case 'insertImage': {
        const url = window.prompt('Image URL', 'https://');
        if (!url) {
          break;
        }

        const safe = url.trim();
        if (!safe) {
          break;
        }

        editor.chain().focus().insertContent(`<img src="${escapeAttribute(safe)}" alt="" />`).run();
        break;
      }
      case 'insertTable':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'addRowAfter':
        editor.chain().focus().addRowAfter().run();
        break;
      case 'addColumnAfter':
        editor.chain().focus().addColumnAfter().run();
        break;
      case 'mergeCells':
        editor.chain().focus().mergeCells().run();
        break;
      case 'splitCell':
        editor.chain().focus().splitCell().run();
        break;
      case 'deleteTable':
        editor.chain().focus().deleteTable().run();
        break;
      case 'subscript':
        editor.chain().focus().toggleSubscript().run();
        break;
      case 'superscript':
        editor.chain().focus().toggleSuperscript().run();
        break;
      case 'clear': {
        const selection = editor.state.selection;
        if (selection.empty) {
          editor.chain().focus().unsetAllMarks().clearNodes().run();
        } else {
          editor.chain().focus().unsetAllMarks().run();
        }
        break;
      }
      default:
        break;
    }

    setActiveStates();
    syncLivePreview();
  });

  const fontSearch = toolbar.querySelector<HTMLInputElement>('input[name="fontFamilySearch"]');
  if (fontSearch) {
    const applyFontFromSearch = () => {
      const value = fontSearch.value.trim();
      editor.commands.focus();
      if (!value) {
        editor.chain().focus().unsetFontFamily().run();
      } else {
        editor.chain().focus().setFontFamily(value).run();
      }
      syncLivePreview();
    };

    fontSearch.addEventListener('change', applyFontFromSearch);
    fontSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyFontFromSearch();
      }
    });
  }

  const fontSizeSelect = toolbar.querySelector<HTMLSelectElement>('select[name="fontSizePx"]');
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', () => {
      editor.commands.focus();
      if (!fontSizeSelect.value) {
        editor.chain().focus().unsetFontSize().run();
      } else {
        editor.chain().focus().setFontSize(fontSizeSelect.value).run();
      }
      syncLivePreview();
    });
  }
}

function wireContextMenu(
  backdrop: HTMLElement,
  editor: Editor,
  setActiveStates: () => void,
  syncLivePreview: () => void
): () => void {
  const menu = backdrop.querySelector<HTMLElement>('.mdpdf-context-menu');
  const editorRoot = backdrop.querySelector<HTMLElement>('.mdpdf-editor-canvas .mdpdf-tiptap');
  if (!menu || !editorRoot) {
    return () => undefined;
  }

  const textColorInput = menu.querySelector<HTMLInputElement>('input[name="contextTextColor"]');
  const highlightColorInput = menu.querySelector<HTMLInputElement>('input[name="contextHighlightColor"]');
  const fontSearchInput = menu.querySelector<HTMLInputElement>('input[name="contextFontFamilySearch"]');

  const closeMenu = () => {
    menu.hidden = true;
  };

  const openMenu = (clientX: number, clientY: number) => {
    const rect = backdrop.getBoundingClientRect();
    const left = Math.max(8, Math.min(clientX - rect.left, rect.width - 280));
    const top = Math.max(8, Math.min(clientY - rect.top, rect.height - 220));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.hidden = false;
  };

  const runSimpleAction = (action: 'bold' | 'italic' | 'underline' | 'highlight') => {
    editor.commands.focus();

    if (action === 'bold') {
      editor.chain().focus().toggleBold().run();
    } else if (action === 'italic') {
      editor.chain().focus().toggleItalic().run();
    } else if (action === 'underline') {
      editor.chain().focus().toggleUnderline().run();
    } else if (action === 'highlight') {
      const color = highlightColorInput?.value || '#fff59d';
      editor.chain().focus().setBackgroundColor(color).run();
    }

    setActiveStates();
    syncLivePreview();
  };

  const onContextMenu = (event: MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editorRoot.contains(range.commonAncestorContainer)) {
      return;
    }

    event.preventDefault();

    const attrs = editor.getAttributes('textStyle') as { color?: string; backgroundColor?: string; fontFamily?: string };
    if (textColorInput && attrs.color) {
      textColorInput.value = normalizeHexColor(attrs.color);
    }
    if (highlightColorInput && attrs.backgroundColor) {
      highlightColorInput.value = normalizeHexColor(attrs.backgroundColor);
    }
    if (fontSearchInput && attrs.fontFamily) {
      fontSearchInput.value = attrs.fontFamily;
    }

    openMenu(event.clientX, event.clientY);
  };

  const onMenuClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button[data-context-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-context-action');
    if (action === 'bold' || action === 'italic' || action === 'underline' || action === 'highlight') {
      runSimpleAction(action);
    }
  };

  const applyTextColor = () => {
    const value = textColorInput?.value?.trim();
    if (!value) {
      return;
    }

    editor.chain().focus().setColor(value).run();
    setActiveStates();
    syncLivePreview();
  };

  const applyFont = () => {
    const value = fontSearchInput?.value?.trim();
    if (!fontSearchInput) {
      return;
    }

    if (!value) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(value).run();
    }
    setActiveStates();
    syncLivePreview();
  };

  const onGlobalMouseDown = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!menu.contains(target)) {
      closeMenu();
    }
  };

  const onGlobalKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  };

  const scrollHost = backdrop.querySelector('.mdpdf-editor-canvas-wrap');

  editorRoot.addEventListener('contextmenu', onContextMenu);
  menu.addEventListener('click', onMenuClick);
  textColorInput?.addEventListener('input', applyTextColor);
  fontSearchInput?.addEventListener('change', applyFont);
  fontSearchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFont();
    }
  });
  document.addEventListener('mousedown', onGlobalMouseDown, true);
  document.addEventListener('keydown', onGlobalKeyDown, true);
  scrollHost?.addEventListener('scroll', closeMenu, { passive: true });

  return () => {
    editorRoot.removeEventListener('contextmenu', onContextMenu);
    menu.removeEventListener('click', onMenuClick);
    textColorInput?.removeEventListener('input', applyTextColor);
    fontSearchInput?.removeEventListener('change', applyFont);
    document.removeEventListener('mousedown', onGlobalMouseDown, true);
    document.removeEventListener('keydown', onGlobalKeyDown, true);
    scrollHost?.removeEventListener('scroll', closeMenu);
    closeMenu();
  };
}

function normalizeSourceHtmlForEditor(html: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '<p></p>';

  wrapper.querySelectorAll('.mdpdf-actions, .mdpdf-action-row, script, style').forEach((el) => {
    el.remove();
  });

  wrapper.querySelectorAll('[contenteditable], [data-message-author-role], [aria-hidden="true"]').forEach((el) => {
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-message-author-role');
    el.removeAttribute('aria-hidden');
  });

  wrapper.querySelectorAll('p,li,blockquote,h1,h2,h3,h4,h5,h6,td,th,pre,code').forEach((el) => {
    if (!el.hasAttribute('dir')) {
      el.setAttribute('dir', 'auto');
    }
  });

  const cleaned = wrapper.innerHTML.trim();
  if (!cleaned) {
    return '<p></p>';
  }

  return cleaned;
}

function buildExportHtml(editor: Editor): string {
  const html = editor.getHTML();
  return html.trim() || '<p></p>';
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

function normalizeHexColor(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toLowerCase();
  }

  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return '#0f172a';
  }

  const r = Number(match[1]).toString(16).padStart(2, '0');
  const g = Number(match[2]).toString(16).padStart(2, '0');
  const b = Number(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export const __editorTestUtils = {
  applyPreviewSettings,
  renderPageOverlay,
  normalizeDirectionValue,
  normalizeFontSizeValue,
  normalizeDensityValue,
  areSidebarSnapshotsEqual,
  normalizeSourceHtmlForEditor
};

export function closeAdvancedEditor() {
  const existing = document.getElementById(EDITOR_BACKDROP_ID);
  if (existing) {
    existing.remove();
  }
}

function ensureFlaticonUiIconsLoaded() {
  if (document.getElementById(FLATICON_UI_LINK_ID)) {
    return;
  }

  const link = document.createElement('link');
  link.id = FLATICON_UI_LINK_ID;
  link.rel = 'stylesheet';
  link.href = FLATICON_UI_CSS_URL;
  document.head.appendChild(link);
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

.mdpdf-topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.mdpdf-topbar-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #c9d8f1;
  border-radius: 10px;
  background: #fff;
  padding: 0 8px;
  height: 34px;
}

.mdpdf-topbar-field i {
  font-size: 14px;
  color: #4a6290;
}

.mdpdf-topbar-field input {
  border: 0;
  outline: none;
  min-width: 220px;
  font-size: 12px;
  background: transparent;
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
  grid-template-columns: 1fr;
  min-height: 0;
}

.mdpdf-editor-left {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 0;
  border-inline-end: 1px solid #d9e3f7;
}

.mdpdf-editor-toolbar {
  padding: 10px 12px 12px;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  border-bottom: 1px solid #dbe6f8;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.mdpdf-editor-toolbar button,
.mdpdf-editor-select {
  border: 1px solid #c9d8f1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font-size: 12px;
  padding: 6px 9px;
  cursor: pointer;
}

.mdpdf-editor-toolbar button.mdpdf-active {
  border-color: #3b82f6;
  background: #eaf2ff;
}

.mdpdf-editor-select {
  min-width: 126px;
}

.mdpdf-inline-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #c9d8f1;
  border-radius: 8px;
  background: #fff;
  padding-inline-start: 8px;
}

.mdpdf-inline-control i {
  font-size: 14px;
  color: #4a6290;
}

.mdpdf-option-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #c9d8f1;
  border-radius: 999px;
  background: #fff;
  padding: 5px 10px;
  font-size: 11px;
  color: #334155;
  user-select: none;
}

.mdpdf-option-chip input {
  margin: 0;
}

.mdpdf-option-chip i {
  font-size: 13px;
}

.mdpdf-option-chip-top {
  height: 34px;
  border-radius: 10px;
}

.mdpdf-tool-group {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid #deebff;
  border-radius: 10px;
  background: #fff;
}

.mdpdf-tool-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #4b648f;
  text-transform: uppercase;
}

.mdpdf-tool-items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.mdpdf-editor-toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mdpdf-editor-toolbar button i,
.mdpdf-color-tool i,
.mdpdf-font-search-wrap i {
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
}

.mdpdf-editor-toolbar button span {
  font-size: 11px;
  line-height: 1;
}

.mdpdf-icon-flip {
  transform: scaleX(-1);
}

.mdpdf-font-search-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #c9d8f1;
  border-radius: 8px;
  background: #fff;
  padding-inline-start: 8px;
}

.mdpdf-font-search {
  min-width: 180px;
  border: 0 !important;
  padding-inline-start: 0 !important;
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

.mdpdf-context-menu {
  position: fixed;
  z-index: 2147483647;
  min-width: 280px;
  border-radius: 12px;
  border: 1px solid #c8d8f3;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22);
  padding: 8px;
}

.mdpdf-context-menu-header {
  font-size: 11px;
  font-weight: 700;
  color: #4b648f;
  margin-bottom: 6px;
}

.mdpdf-context-menu-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.mdpdf-context-menu-row:last-child {
  margin-bottom: 0;
}

.mdpdf-context-menu button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #c9d8f1;
  background: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mdpdf-context-menu button i {
  font-size: 14px;
}

.mdpdf-context-menu label {
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: #475569;
}

.mdpdf-context-menu input[type="color"] {
  width: 34px;
  height: 30px;
  border: 1px solid #c9d8f1;
  border-radius: 8px;
  background: #fff;
}

.mdpdf-context-menu input[list] {
  border: 1px solid #c9d8f1;
  border-radius: 8px;
  padding: 6px 8px;
  min-width: 170px;
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

.mdpdf-editor-canvas {
  position: relative;
  z-index: 2;
  width: var(--mdpdf-page-width);
  min-height: var(--mdpdf-page-height);
  margin: 0 auto;
  background: transparent;
}

.mdpdf-editor-canvas .mdpdf-tiptap {
  min-height: var(--mdpdf-page-height);
  border: none;
  outline: none;
  padding: calc(var(--mdpdf-page-margin-top) + var(--mdpdf-content-extra-top))
    calc(var(--mdpdf-page-margin-inline) + var(--mdpdf-content-extra-inline))
    calc(var(--mdpdf-page-margin-bottom) + var(--mdpdf-content-extra-bottom));
  color: #0f172a;
  font-size: var(--mdpdf-root-font-size);
  line-height: var(--mdpdf-line-height);
  font-family: "Vazirmatn", "BNazanin", "BYekan", "Tahoma", sans-serif;
  background: transparent;
}

.mdpdf-editor-canvas .mdpdf-tiptap p,
.mdpdf-editor-canvas .mdpdf-tiptap ul,
.mdpdf-editor-canvas .mdpdf-tiptap ol,
.mdpdf-editor-canvas .mdpdf-tiptap pre,
.mdpdf-editor-canvas .mdpdf-tiptap table,
.mdpdf-editor-canvas .mdpdf-tiptap blockquote {
  margin: 0 0 1em;
  unicode-bidi: plaintext;
}

.mdpdf-editor-canvas .mdpdf-tiptap ul,
.mdpdf-editor-canvas .mdpdf-tiptap ol {
  padding-inline-start: 1.45em;
}

.mdpdf-editor-canvas .mdpdf-tiptap [dir="rtl"] {
  direction: rtl;
  text-align: right;
}

.mdpdf-editor-canvas .mdpdf-tiptap [dir="ltr"] {
  direction: ltr;
  text-align: left;
}

.mdpdf-editor-canvas .mdpdf-tiptap pre {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  overflow: auto;
  white-space: pre;
}

.mdpdf-editor-canvas-wrap.mdpdf-code-wrap .mdpdf-tiptap pre {
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}

.mdpdf-editor-canvas .mdpdf-tiptap blockquote {
  border-inline-start: 4px solid #cbd5e1;
  margin-inline-start: 0;
  padding-inline: 12px;
  color: #334155;
}

.mdpdf-editor-canvas .mdpdf-tiptap table {
  border-collapse: collapse;
  width: 100%;
}

.mdpdf-editor-canvas .mdpdf-tiptap td,
.mdpdf-editor-canvas .mdpdf-tiptap th {
  border: 1px solid #d1d5db;
  padding: 8px;
  vertical-align: top;
}

.mdpdf-editor-canvas .mdpdf-tiptap a {
  color: #0f4c81;
  text-decoration: none;
}

.mdpdf-secondary,
.mdpdf-primary {
  border-radius: 10px;
  border: 1px solid #c8d8f2;
  padding: 7px 10px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
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
  .mdpdf-topbar-field input {
    min-width: 150px;
  }
}
`;
}
