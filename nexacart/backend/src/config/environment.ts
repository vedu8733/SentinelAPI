import dotenv from 'dotenv';

dotenv.config();

export interface EnvironmentConfig {
  port: number;
  host: string;
  nodeEnv: string;
  serviceName: string;
  databaseUrl: string;
}

export const config: EnvironmentConfig = {
  port: parseInt(process.env.PORT || '5001', 10),
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: process.env.SERVICE_NAME || 'nexacart-backend',
  databaseUrl: process.env.DATABASE_URL || ''
};
