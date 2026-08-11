import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';

import { config, providerHealth } from './config.js';
import { log } from './lib/logger.js';
import { router } from './routes/index.js';
import { startScheduler } from './lib/scheduler.js';
import { attachWs } from './ws/hub.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  credentials: true
}));
app.use(express.json({ limit: '256kb' }));

app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Slow down.' }
}));

app.get('/health', (_q, r) => r.json({ ok: true, at: Date.now() }));
app.use('/api', router);

app.use((_q, r) => r.status(404).json({ ok: false, error: 'Not found' }));
app.use((err, _q, r, _n) => {
  log.error(err.message);
  r.status(500).json({ ok: false, error: 'Internal error' });
});

const server = createServer(app);
attachWs(server);

server.listen(config.port, async () => {
  log.ok(`Fiper API on http://localhost:${config.port}`);

  const health = providerHealth();
  const on  = Object.entries(health).filter(([, p]) => p.enabled).map(([k]) => k);
  const off = Object.entries(health).filter(([, p]) => !p.enabled);

  log.info(`enabled:  ${on.join(', ')}`);
  if (off.length) {
    log.warn(`disabled: ${off.map(([k]) => k).join(', ')}`);
    off.forEach(([k, p]) => log.warn(`  ${k} → set ${p.needs}`));
  }

  await startScheduler();
});

const shutdown = () => { log.info('shutting down'); server.close(() => process.exit(0)); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
