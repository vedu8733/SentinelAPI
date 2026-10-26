import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { verifyPassword, signToken, hashToken } from '../utils/security';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { authRateLimiter } from '../middleware/rateLimiter';

export const authRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$GocnTruA5TLRZxC2kUEbOA$f1wVMThaHCU5G6sn4faX4ZfWYLFilm4ZHzRQWkeaYWA';

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues a session-bound JWT.
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Valid email and password are required.'
        }
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid email address format.'
        }
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // Constant-time mitigation: generic response whether user exists or not
    if (!user || !user.isActive) {
      await verifyPassword(password, DUMMY_HASH);
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.'
        }
      });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.'
        }
      });
      return;
    }

    // Provision an authenticated session
    const sessionId = crypto.randomUUID();
    const token = signToken({
      sub: user.id,
      sessionId,
      role: user.role,
      email: user.email
    });

    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.$transaction([
      prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          tokenHash,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.headers['user-agent'] || null,
          expiresAt
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })
    ]);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Revokes the active session token.
 */
authRouter.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.session) {
      await prisma.session.update({
        where: { id: req.session.id },
        data: { revokedAt: new Date() }
      });
    }

    res.status(200).json({
      message: 'Logged out successfully.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile.
 */
authRouter.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    }
  });
});

/**
 * GET /api/auth/admin-check
 * Protected check verifying administrator role authorization.
 */
authRouter.get(
  '/admin-check',
  authenticate,
  requireRole(Role.ADMIN),
  (_req: Request, res: Response): void => {
    res.status(200).json({
      message: 'Administrator authorization confirmed.'
    });
  }
);
