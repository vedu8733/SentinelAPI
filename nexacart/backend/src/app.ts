import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.route';
import { productsRouter } from './routes/products.route';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // JSON payload parser
  app.use(express.json({ limit: '100kb' }));

  // CORS configuration allowing local frontend and SentinelAPI gateway
  const allowedOrigins = [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:4000',
    'http://127.0.0.1:4000'
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in local development
        }
      },
      credentials: true
    })
  );

  // Mount API Routes
  app.use('/api', healthRouter);
  app.use('/api/products', productsRouter);

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found on NexaCart API.'
      }
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
