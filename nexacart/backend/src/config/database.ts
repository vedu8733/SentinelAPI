import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

declare global {
  // eslint-disable-next-line no-var
  var __nexacartPrisma: PrismaClient | undefined;
}

export const prisma = global.__nexacartPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__nexacartPrisma = prisma;
}
