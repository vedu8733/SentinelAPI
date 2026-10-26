import dotenv from 'dotenv';

dotenv.config();

export interface EnvironmentConfig {
  port: number;
  host: string;
  nodeEnv: string;
  serviceName: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitWindowMs: number;
  authRateLimitMax: number;
  failedLoginThreshold: number;
  failedLoginWindowMs: number;
  eventCooldownMs: number;
  hmacSecret: string;
  hmacKeyId: string;
  incidentAggregationWindowMs: number;
  nexacartUpstreamUrl: string;
  nexacartRateLimitMax: number;
  nexacartRateLimitWindowMs: number;
}

export const config: EnvironmentConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: process.env.SERVICE_NAME || 'sentinel-api-backend',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  authRateLimitWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '60000', 10),
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  failedLoginThreshold: parseInt(process.env.FAILED_LOGIN_THRESHOLD || '5', 10),
  failedLoginWindowMs: parseInt(process.env.FAILED_LOGIN_WINDOW_MS || '300000', 10),
  eventCooldownMs: parseInt(process.env.EVENT_COOLDOWN_MS || '30000', 10),
  hmacSecret: process.env.HMAC_SECRET || '',
  hmacKeyId: process.env.HMAC_KEY_ID || 'sentinel-hmac-v1',
  incidentAggregationWindowMs: parseInt(process.env.INCIDENT_AGGREGATION_WINDOW_MS || '900000', 10),
  nexacartUpstreamUrl: process.env.NEXACART_UPSTREAM_URL || 'http://127.0.0.1:5001',
  nexacartRateLimitMax: parseInt(process.env.NEXACART_RATE_LIMIT_MAX || '120', 10),
  nexacartRateLimitWindowMs: parseInt(process.env.NEXACART_RATE_LIMIT_WINDOW_MS || '60000', 10)
};
