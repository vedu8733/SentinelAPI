import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { verifyToken, hashToken } from '../utils/security';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required.'
      }
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is empty.'
      }
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    const tokenHash = hashToken(token);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!session || session.id !== payload.sessionId || session.userId !== payload.sub) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session not found or invalid.'
        }
      });
      return;
    }

    if (session.revokedAt !== null) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session has been revoked.'
        }
      });
      return;
    }

    if (new Date() > session.expiresAt) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session has expired.'
        }
      });
      return;
    }

    if (!session.user.isActive) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Account is deactivated.'
        }
      });
      return;
    }

    req.user = session.user;
    req.session = session;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: err.name === 'TokenExpiredError'
          ? 'Token has expired.'
          : 'Invalid authentication token.'
      }
    });
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.'
        }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: insufficient permissions.'
        }
      });
      return;
    }

    next();
  };
}
