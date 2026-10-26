import { app } from './app';
import { config } from './config/environment';

const server = app.listen(config.port, config.host, () => {
  console.log(`[SentinelAPI Backend] Server running at http://${config.host}:${config.port}`);
  console.log(`[SentinelAPI Backend] Environment: ${config.nodeEnv}`);
});

function gracefulShutdown(signal: string): void {
  console.log(`\n[SentinelAPI Backend] Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    console.log('[SentinelAPI Backend] HTTP server closed cleanly. Exiting process.');
    process.exit(0);
  });

  // Force close if clean shutdown takes too long
  setTimeout(() => {
    console.error('[SentinelAPI Backend] Forcing shutdown after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
