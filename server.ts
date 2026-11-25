import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { bundleProjectFiles } from './serverBundler.ts';
import { pullFromGitHubRepo, pushToGitHubRepo } from './serverGithub.ts';
import {
  createSlidingWindowRateLimiter,
  validateBundleProjectPayload,
  validateGithubPullPayload,
  validateGithubPushPayload,
} from './src/utils/serverValidation.ts';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '50mb' }));

  const bundleRateLimiter = createSlidingWindowRateLimiter({
    maxRequests: 60,
    windowMs: 60_000,
  });
  const githubRateLimiter = createSlidingWindowRateLimiter({
    maxRequests: 30,
    windowMs: 60_000,
  });

  const enforceRateLimit = (
    limiter: ReturnType<typeof createSlidingWindowRateLimiter>,
    req: express.Request,
    res: express.Response
  ): boolean => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const check = limiter.check(clientIp);
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSec));
      res.status(429).json({
        ok: false,
        error: `Too many requests. Please wait ${check.retryAfterSec}s before retrying.`,
      });
      return false;
    }
    return true;
  };

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
    if (!enforceRateLimit(bundleRateLimiter, req, res)) return;
    try {
      const validated = validateBundleProjectPayload(req.body);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }
      const bundle = await bundleProjectFiles(validated.data.files, validated.data.entryPath);
      res.json(bundle);
    } catch (err) {
      console.error('Bundle project route error:', err);
      res.status(500).json({ error: 'Unable to bundle project files right now.' });
    }
  });

  app.post('/api/github/pull', async (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    try {
      const validated = validateGithubPullPayload(req.body);
      if (!validated.ok) {
        res.status(400).json({ ok: false, error: validated.error });
        return;
      }
      const result = await pullFromGitHubRepo(validated.data);
      res.status(result.ok ? 200 : result.requiresAuth ? 401 : 400).json(result);
    } catch (err) {
      console.error('GitHub pull route error:', err);
      res.status(500).json({ ok: false, error: 'Unable to pull from GitHub right now.' });
    }
  });

  app.post('/api/github/push', async (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    try {
      const validated = validateGithubPushPayload(req.body);
      if (!validated.ok) {
        res.status(400).json({ ok: false, error: validated.error });
        return;
      }
      const result = await pushToGitHubRepo(validated.data);
      res.status(result.ok ? 200 : result.requiresAuth ? 401 : 400).json(result);
    } catch (err) {
      console.error('GitHub push route error:', err);
      res.status(500).json({ ok: false, error: 'Unable to push commit to GitHub right now.' });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
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
