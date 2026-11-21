import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { bundleProjectFiles, type BundleInputFile } from './serverBundler.ts';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '50mb' }));

  app.get('/esbuild.wasm', (_req, res) => {
    const wasmPath = path.resolve(process.cwd(), 'node_modules/esbuild-wasm/esbuild.wasm');
    if (fs.existsSync(wasmPath)) {
      res.setHeader('Content-Type', 'application/wasm');
      res.sendFile(wasmPath);
      return;
    }
    res.status(404).send('esbuild.wasm not found');
  });

  app.post('/api/bundle-project', async (req, res) => {
    try {
      const body = req.body as {
        files?: BundleInputFile[];
        entryPath?: string;
      };
      if (!Array.isArray(body?.files) || typeof body?.entryPath !== 'string' || !body.entryPath) {
        res.status(400).json({ error: 'Invalid bundle request: files array and entryPath are required.' });
        return;
      }
      const bundle = await bundleProjectFiles(body.files, body.entryPath);
      res.json(bundle);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Framecraft server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
