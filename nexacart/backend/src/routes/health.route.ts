import { Router, Request, Response } from 'express';
import { config } from '../config/environment';
import { prisma } from '../config/database';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'connected';
  try {
    // Quick query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = 'disconnected';
  }

  res.status(200).json({
    status: 'ok',
    service: config.serviceName,
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});
