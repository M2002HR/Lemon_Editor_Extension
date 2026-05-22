import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import { renderMarkdownToPdf } from './renderer.js';
import type { MarkdownToPdfRequestBody } from './types.js';
import { HttpError, validateRequestBody } from './validation.js';

export function createApp() {
  const app = express();

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

  app.use(express.json({ limit: '300kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'markdown-to-pdf' });
  });

  app.post('/api/v1/markdown-to-pdf', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = validateRequestBody(req.body as MarkdownToPdfRequestBody);
      const pdf = await renderMarkdownToPdf(payload.markdown, payload.title);

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
  if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
    return true;
  }

  if (/^https:\/\/(chatgpt\.com|chat\.openai\.com)$/.test(origin)) {
    return true;
  }

  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
