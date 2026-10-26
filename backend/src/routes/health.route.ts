import { Router, Request, Response } from 'express';
import { config } from '../config/environment';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: config.serviceName,
    timestamp: new Date().toISOString()
  });
});
