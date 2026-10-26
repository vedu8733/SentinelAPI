import crypto from 'crypto';
import { hash, verify } from '@node-rs/argon2';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/environment';

export interface JwtPayload {
  sub: string;
  sessionId: string;
  role: string;
  email: string;
}

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: 2 // Argon2id
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * Hashes an authorization or session token with SHA-256 for safe database storage.
 * Plaintext tokens are never stored in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Signs a JWT token with the configured secret and explicit HS256 algorithm.
 */
export function signToken(payload: JwtPayload, expiresInOverride?: string | number): string {
  if (!config.jwtSecret || config.jwtSecret.trim().length < 16) {
    throw new Error('JWT_SECRET is missing or insufficiently secure in environment configuration.');
  }

  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: (expiresInOverride !== undefined ? expiresInOverride : config.jwtExpiresIn) as any
  };

  return jwt.sign(payload, config.jwtSecret, options);
}

/**
 * Verifies a JWT token with the explicit HS256 algorithm.
 */
export function verifyToken(token: string): JwtPayload {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is missing in environment configuration.');
  }

  return jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256']
  }) as JwtPayload;
}
