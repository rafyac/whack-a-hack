import './env.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { api } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const spaDir = path.resolve(__dirname, '../public');

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  if (process.env.NODE_ENV !== 'production') {
    app.use(
      cors({
        origin: ['http://localhost:5173'],
        credentials: true,
      })
    );
  }

  app.use('/api', api);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  if (fs.existsSync(spaDir)) {
    app.use(express.static(spaDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(spaDir, 'index.html'));
    });
  }

  return app;
}

export function startServer(port = Number(process.env.PORT) || 8080) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`voting-server listening on :${port}`);
  });
}

const isMainModule =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  startServer();
}
