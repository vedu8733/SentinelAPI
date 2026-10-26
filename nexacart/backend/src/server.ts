import { app } from './app';
import { config } from './config/environment';

const server = app.listen(config.port, config.host, () => {
  console.log(`[NexaCart API] Server listening at http://${config.host}:${config.port}`);
  console.log(`[NexaCart API] Environment: ${config.nodeEnv}`);
});

function gracefulShutdown(signal: string): void {
  console.log(`\n[NexaCart API] Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    console.log('[NexaCart API] HTTP server closed cleanly. Exiting.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[NexaCart API] Forcing shutdown after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
