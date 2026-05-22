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
const FONT_SIZE_OPTIONS = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

export function openAdvancedEditor(args: OpenEditorArgs): Promise<EditorExportResult | null> {
  closeAdvancedEditor();

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
        <button type="button" class="mdpdf-editor-close" aria-label="Close">✕</button>
      </header>

      <div class="mdpdf-editor-main">
        <section class="mdpdf-editor-left">
          <div class="mdpdf-editor-toolbar" role="toolbar" aria-label="Text tools">
            <button type="button" data-action="undo">Undo</button>
            <button type="button" data-action="redo">Redo</button>

            <button type="button" data-action="bold"><b>B</b></button>
            <button type="button" data-action="italic"><i>I</i></button>
            <button type="button" data-action="underline"><u>U</u></button>
            <button type="button" data-action="strike"><s>S</s></button>
            <button type="button" data-action="code">Inline Code</button>

            <button type="button" data-action="paragraph">P</button>
            <button type="button" data-action="h1">H1</button>
            <button type="button" data-action="h2">H2</button>
            <button type="button" data-action="h3">H3</button>
            <button type="button" data-action="blockquote">Quote</button>
            <button type="button" data-action="codeblock">Code Block</button>

            <button type="button" data-action="bulletList">• List</button>
            <button type="button" data-action="orderedList">1. List</button>
            <button type="button" data-action="taskList">☐ Task</button>

            <button type="button" data-action="alignLeft">Left</button>
            <button type="button" data-action="alignCenter">Center</button>
            <button type="button" data-action="alignRight">Right</button>
            <button type="button" data-action="alignJustify">Justify</button>

            <button type="button" data-action="rtl">RTL Line</button>
            <button type="button" data-action="ltr">LTR Line</button>

            <select class="mdpdf-editor-select" name="fontFamily" title="Font family">
              <option value="">Font</option>
              ${fontOptions}
            </select>

            <select class="mdpdf-editor-select" name="fontSizePx" title="Selected text size">
              <option value="">Text size</option>
              ${FONT_SIZE_OPTIONS.map((size) => `<option value="${size}">${size}</option>`).join('')}
            </select>

            <label class="mdpdf-color-tool" title="Text color">
              <span>Text</span>
              <input type="color" name="textColor" value="#0f172a" />
            </label>
            <label class="mdpdf-color-tool" title="Background color">
              <span>Mark</span>
              <input type="color" name="highlightColor" value="#fff59d" />
            </label>

            <button type="button" data-action="applyTextColor">Apply Text</button>
            <button type="button" data-action="applyHighlight">Apply Mark</button>

            <button type="button" data-action="setLink">Link</button>
            <button type="button" data-action="unsetLink">Unlink</button>
            <button type="button" data-action="insertImage">Image URL</button>

            <button type="button" data-action="insertTable">Table</button>
            <button type="button" data-action="addRowAfter">+Row</button>
            <button type="button" data-action="addColumnAfter">+Col</button>
            <button type="button" data-action="mergeCells">Merge</button>
            <button type="button" data-action="splitCell">Split</button>
            <button type="button" data-action="deleteTable">Del Table</button>

            <button type="button" data-action="subscript">Sub</button>
            <button type="button" data-action="superscript">Sup</button>
            <button type="button" data-action="clear">Clear</button>
          </div>

          <div class="mdpdf-editor-canvas-wrap">
            <div class="mdpdf-page-overlay"></div>
            <div class="mdpdf-editor-canvas"></div>
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

          <p class="mdpdf-editor-note">Preview uses the same render API as final download, so final PDF should match this preview.</p>

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

  const editorContainer = backdrop.querySelector<HTMLElement>('.mdpdf-editor-canvas');
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
    !editorContainer ||
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
    }, 520);
  };

  const syncPreviewLayout = () => {
    const options = readOptionsFromSidebar();
    const root = getEditorRoot();
    applyPreviewSettings(root, canvasWrap, overlay, options);
    renderPageOverlay(root, overlay, options.pageBorder, options.pageNumbers);
  };

  const syncLivePreview = () => {
    syncPreviewLayout();
    schedulePdfPreview();
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

  const updatePdfPreview = async () => {
    const options = readOptionsFromSidebar();
    const payload = {
      html: buildExportHtml(editor),
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

      setLivePreviewStatus(error instanceof Error ? error.message : 'Preview failed');
    }
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
    const fontFamilySelect = backdrop.querySelector<HTMLSelectElement>('select[name="fontFamily"]');
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

    if (fontFamilySelect) {
      fontFamilySelect.value = attrs.fontFamily ?? '';
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

      if (previewTimer !== null) {
        window.clearTimeout(previewTimer);
      }
      if (previewAbort) {
        previewAbort.abort();
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

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

  const fontSelect = toolbar.querySelector<HTMLSelectElement>('select[name="fontFamily"]');
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      editor.commands.focus();
      if (!fontSelect.value) {
        editor.chain().focus().unsetFontFamily().run();
      } else {
        editor.chain().focus().setFontFamily(fontSelect.value).run();
      }
      syncLivePreview();
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
  areSidebarSnapshotsEqual,
  normalizeSourceHtmlForEditor
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
  grid-template-columns: 1fr 330px;
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
