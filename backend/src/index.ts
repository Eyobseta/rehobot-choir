import { createApp } from './app';
import { env } from './config/env';
import { startScheduler } from './scheduler';

function start() {
  const app = createApp();

  const server = app.listen(env.port, env.host, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[rehobot-backend] ${env.nodeEnv} listening on http://${env.host}:${env.port}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[rehobot-backend] health: http://localhost:${env.port}/api/v1/health`,
    );
    startScheduler();
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[rehobot-backend] ${signal} received, shutting down...`);
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log('[rehobot-backend] closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();