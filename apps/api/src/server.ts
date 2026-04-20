import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

const server = app.listen(env.port, env.host, () => {
  console.log(`[msnavi-api] listening on http://${env.host}:${env.port} (${env.nodeEnv})`);
  console.log(`[msnavi-api] CORS origins: ${env.corsOrigins.join(', ') || '(none)'}`);
});

function shutdown(signal: string) {
  console.log(`[msnavi-api] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
