// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import type { PdfRenderOptions } from '../src/types.js';

let __editorTestUtils: typeof import('../src/editor.js').__editorTestUtils;

beforeAll(async () => {
  Object.assign(globalThis, {
    chrome: {
      runtime: {
        getURL: (value: string) => value
      }
    }
  });

  ({ __editorTestUtils } = await import('../src/editor.js'));
});

describe('editor utilities', () => {
  it('normalizes sidebar enum values', () => {
    expect(__editorTestUtils.normalizeDirectionValue('rtl')).toBe('rtl');
    expect(__editorTestUtils.normalizeDirectionValue('invalid')).toBe('auto');

    expect(__editorTestUtils.normalizeFontSizeValue('small')).toBe('small');
    expect(__editorTestUtils.normalizeFontSizeValue('x')).toBe('medium');

    expect(__editorTestUtils.normalizeDensityValue('compact')).toBe('compact');
    expect(__editorTestUtils.normalizeDensityValue('x')).toBe('normal');
  });

  it('applies page margins and border-aware padding to preview canvas', () => {
    const editor = document.createElement('div');
    editor.textContent = 'متن تست';
    const wrap = document.createElement('div');
    const overlay = document.createElement('div');

    const options: PdfRenderOptions = {
      direction: 'rtl',
      pageNumbers: true,
      pageBorder: true,
      smartPagination: true,
      fontSize: 'medium',
      density: 'normal',
      codeWrap: false
    };

    __editorTestUtils.applyPreviewSettings(editor, wrap, overlay, options);

    expect(wrap.style.getPropertyValue('--mdpdf-page-margin-top')).toBe('16mm');
    expect(wrap.style.getPropertyValue('--mdpdf-page-margin-bottom')).toBe('18mm');
    expect(wrap.style.getPropertyValue('--mdpdf-content-extra-top')).toBe('10mm');
    expect(wrap.style.getPropertyValue('--mdpdf-content-extra-inline')).toBe('10mm');
    expect(editor.getAttribute('dir')).toBe('rtl');
    expect(overlay.getAttribute('dir')).toBe('rtl');
  });

  it('renders per-page frame and page numbers in overlay', () => {
    const editor = document.createElement('div');
    const overlay = document.createElement('div');
    Object.defineProperty(editor, 'scrollHeight', { value: 2500, configurable: true });

    __editorTestUtils.renderPageOverlay(editor, overlay, true, true);
    expect(overlay.querySelectorAll('.mdpdf-page-box').length).toBe(3);
    expect(overlay.querySelectorAll('.mdpdf-page-frame').length).toBe(3);
    expect(overlay.querySelectorAll('.mdpdf-page-number').length).toBe(3);

    overlay.innerHTML = '';
    __editorTestUtils.renderPageOverlay(editor, overlay, false, false);
    expect(overlay.querySelectorAll('.mdpdf-page-frame').length).toBe(0);
    expect(overlay.querySelectorAll('.mdpdf-page-number').length).toBe(0);
  });

  it('compares sidebar snapshots deterministically', () => {
    const base = {
      filename: 'a.pdf',
      direction: 'auto',
      fontSize: 'medium',
      density: 'normal',
      smartPagination: true,
      pageBorder: false,
      pageNumbers: false,
      codeWrap: false
    } as const;

    expect(__editorTestUtils.areSidebarSnapshotsEqual(base, { ...base })).toBe(true);
    expect(__editorTestUtils.areSidebarSnapshotsEqual(base, { ...base, pageBorder: true })).toBe(false);
  });

  it('normalizes source html before handing it to the open-source editor', () => {
    const source = `
      <div data-message-author-role="assistant" contenteditable="false">
        <h2>Title</h2>
        <p>Body</p>
        <div class="mdpdf-actions">should be removed</div>
        <script>alert('x')</script>
      </div>
    `;

    const normalized = __editorTestUtils.normalizeSourceHtmlForEditor(source);
    expect(normalized).toContain('<h2 dir="auto">Title</h2>');
    expect(normalized).toContain('<p dir="auto">Body</p>');
    expect(normalized).not.toContain('mdpdf-actions');
    expect(normalized).not.toContain('<script');
    expect(normalized).not.toContain('contenteditable');
  });
});
