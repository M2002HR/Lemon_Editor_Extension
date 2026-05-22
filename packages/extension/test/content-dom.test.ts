// @vitest-environment jsdom
import TurndownService from 'turndown';
import { describe, expect, it } from 'vitest';
import { ACTION_CLASS, buildDefaultFilename, extractMessageHtml, findAssistantMessages } from '../src/content/dom.js';
import { buildDownloadRequest } from '../src/content/messages.js';

describe('content dom helpers', () => {
  it('finds only assistant messages', () => {
    document.body.innerHTML = `
      <div data-message-author-role="user">u1</div>
      <div data-message-author-role="assistant">a1</div>
      <div data-message-author-role="assistant">a2</div>
    `;

    const found = findAssistantMessages(document);
    expect(found).toHaveLength(2);
    expect(found[0]!.textContent).toContain('a1');
  });

  it('extracts message html without extension controls and keeps markdown-like structures', () => {
    document.body.innerHTML = `
      <div data-message-author-role="assistant">
        <div class="markdown">
          <h2>Heading</h2>
          <p>A <a href="https://example.com">link</a></p>
          <ul><li>one</li><li>two</li></ul>
          <pre><code>const x = 1;</code></pre>
        </div>
        <div class="${ACTION_CLASS}"><button>PDF</button></div>
      </div>
    `;

    const message = findAssistantMessages(document)[0];
    expect(message).toBeDefined();
    const html = extractMessageHtml(message!);

    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).toContain('<pre><code>const x = 1;</code></pre>');
    expect(html).not.toContain('PDF');

    const markdown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).turndown(html);
    expect(markdown).toContain('## Heading');
    expect(markdown).toContain('[link](https://example.com)');
    expect(markdown).toContain('*   one');
    expect(markdown).toContain('```');
  });

  it('builds deterministic filename and download payload', () => {
    const fixed = new Date(2026, 4, 22, 12, 34, 56);
    const filename = buildDefaultFilename(fixed);

    expect(filename).toBe('chatgpt-answer-20260522-123456.pdf');

    const request = buildDownloadRequest({
      markdown: '# test',
      filename,
      title: 'Title',
      options: {
        direction: 'auto',
        pageNumbers: false,
        pageBorder: false,
        smartPagination: true,
        fontSize: 'medium',
        density: 'normal',
        codeWrap: false
      }
    });

    expect(request).toEqual({
      type: 'DOWNLOAD_PDF_REQUEST',
      payload: {
        markdown: '# test',
        title: 'Title',
        filename,
        options: {
          direction: 'auto',
          pageNumbers: false,
          pageBorder: false,
          smartPagination: true,
          fontSize: 'medium',
          density: 'normal',
          codeWrap: false
        }
      }
    });
  });
});
