import express, { Application } from 'express';
import { healthRouter } from './routes/health.route';
import { authRouter } from './routes/auth.route';
import { integrityRouter } from './routes/integrity.route';
import { incidentRouter } from './routes/incident.route';
import { serviceRouter } from './routes/service.route';
import { eventRouter } from './routes/event.route';
import { gatewayRouter } from './routes/gateway.route';
import { requestLogger } from './middleware/requestLogger';
import { globalRateLimiter } from './middleware/rateLimiter';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Parse incoming JSON payloads with a conservative 100kb limit
  app.use(express.json({ limit: '100kb' }));

  // Development Cross-Origin Resource Sharing (CORS) with explicit local frontend origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001'
  ];
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });

  // Global request logging & audit monitoring
  app.use(requestLogger);

  // Global API rate limiting
  app.use('/api', globalRateLimiter);

  // Native API Routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/integrity', integrityRouter);
  app.use('/api/incidents', incidentRouter);
  app.use('/api/services', serviceRouter);
  app.use('/api/events', eventRouter);

  // Dedicated NexaCart Store Gateway Proxy Route
  app.use('/api/gateway/nexacart', gatewayRouter);

  // 404 Handler for unmatched routes
  app.use(notFoundHandler);

  // Centralized Error Handler (must be registered after routes and 404 handler)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
