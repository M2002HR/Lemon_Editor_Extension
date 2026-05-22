import { describe, expect, it } from 'vitest';
import { renderMarkdownToPdf } from '../src/renderer.js';

describe('renderer integration', () => {
  it('generates a non-empty PDF buffer for rich markdown', async () => {
    const markdown = [
      '# Title',
      '',
      'A [link](https://example.com)',
      '',
      '- one',
      '- two',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '| Col | Value |',
      '| --- | --- |',
      '| A | B |'
    ].join('\n');

    const pdf = await renderMarkdownToPdf(markdown, 'Integration Test', {
      direction: 'auto',
      pageNumbers: true,
      pageBorder: true,
      smartPagination: true,
      fontSize: 'medium',
      density: 'normal',
      codeWrap: false
    });

    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  }, 30_000);
});
