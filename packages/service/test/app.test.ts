import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { MAX_MARKDOWN_LENGTH } from '../src/constants.js';
import { createApp } from '../src/app.js';

describe('service app routes', () => {
  it('GET /health returns service status', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'markdown-to-pdf' });
  });

  it('POST /api/v1/markdown-to-pdf returns a PDF with sanitized filename', async () => {
    const render = vi.fn().mockResolvedValue(Buffer.from('%PDF-test-content'));
    const app = createApp({ render });

    const response = await request(app)
      .post('/api/v1/markdown-to-pdf')
      .set('Origin', 'http://localhost:3000')
      .send({
        markdown: '# Hello\n\n- item\n\n```js\nconsole.log(1)\n```',
        title: 'Sample',
        filename: 'my export!!.pdf'
      });

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toContain('application/pdf');
    expect(response.header['content-disposition']).toContain('filename="my-export.pdf"');
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for empty markdown', async () => {
    const app = createApp();

    const response = await request(app).post('/api/v1/markdown-to-pdf').send({ markdown: '    ' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('cannot be empty');
  });

  it('returns 413 for oversized markdown payload', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/markdown-to-pdf')
      .send({ markdown: 'a'.repeat(MAX_MARKDOWN_LENGTH + 1) });

    expect(response.status).toBe(413);
    expect(response.body.error).toContain('cannot exceed');
  });
});
