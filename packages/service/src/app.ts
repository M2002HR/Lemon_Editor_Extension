import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ALLOWED_ORIGIN_PATTERNS, ALLOW_CHROME_EXTENSION_ORIGINS, JSON_BODY_LIMIT } from './constants.js';
import { renderMarkdownToPdf } from './renderer.js';
import type { MarkdownToPdfRequestBody, PdfInputFormat, PdfRenderOptions } from './types.js';
import { HttpError, validateRequestBody } from './validation.js';

interface CreateAppOptions {
  render?: (content: string, title: string | undefined, options: PdfRenderOptions, inputFormat: PdfInputFormat) => Promise<Buffer>;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const render = options.render ?? renderMarkdownToPdf;

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new HttpError(403, `Origin not allowed: ${origin}`));
      }
    })
  );

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'markdown-to-pdf' });
  });

  app.post('/api/v1/markdown-to-pdf', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = validateRequestBody(req.body as MarkdownToPdfRequestBody);
      const pdf = await render(payload.content, payload.title, payload.options, payload.inputFormat);

      res
        .status(200)
        .setHeader('Content-Type', 'application/pdf')
        .setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`)
        .send(pdf);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Unknown server error' });
  });

  return app;
}

function isAllowedOrigin(origin: string): boolean {
  if (ALLOW_CHROME_EXTENSION_ORIGINS && /^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
    return true;
  }

  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => matchesOriginPattern(origin, pattern));
}

function matchesOriginPattern(origin: string, pattern: string): boolean {
  const normalizedPattern = pattern.trim().replace(/\/$/, '');
  const normalizedOrigin = origin.trim().replace(/\/$/, '');

  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern === '*') {
    return true;
  }

  if (normalizedPattern.endsWith(':*')) {
    const base = normalizedPattern.slice(0, -2);
    return normalizedOrigin === base || normalizedOrigin.startsWith(`${base}:`);
  }

  if (normalizedPattern.endsWith('*')) {
    const prefix = normalizedPattern.slice(0, -1);
    return normalizedOrigin.startsWith(prefix);
  }

  return normalizedOrigin === normalizedPattern;
}
