import dotenv from 'dotenv';
import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { hashPassword } from '../utils/security';

dotenv.config();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (password.length < 12) {
    return { valid: false, reason: 'Password must be at least 12 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one numeric digit.' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one special character.' };
  }
  return { valid: true };
}

export async function createAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME || 'System Administrator';

  if (!email || !password) {
    console.error('[SentinelAPI Admin Setup] Error: Both ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    console.error('[SentinelAPI Admin Setup] Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=... npm run admin:create');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    console.error('[SentinelAPI Admin Setup] Error: Invalid email format provided for ADMIN_EMAIL.');
    process.exit(1);
  }

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    console.error(`[SentinelAPI Admin Setup] Error: Weak password. ${passwordCheck.reason}`);
    process.exit(1);
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      console.warn(`[SentinelAPI Admin Setup] User with email "${normalizedEmail}" already exists (Role: ${existingUser.role}).`);
      console.warn('[SentinelAPI Admin Setup] Aborted: to protect account integrity, existing administrator credentials were not modified.');
      return;
    }

    const passwordHash = await hashPassword(password);

    const admin = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: fullName.trim(),
        role: Role.ADMIN,
        isActive: true
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'ADMIN_PROVISIONED',
        entityType: 'User',
        entityId: admin.id,
        details: { email: admin.email, role: admin.role }
      }
    });

    console.log(`[SentinelAPI Admin Setup] Success: Administrator provisioned for ${admin.email} (Role: ADMIN).`);
  } catch (error) {
    console.error('[SentinelAPI Admin Setup] Unexpected error provisioning administrator:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly from CLI
if (require.main === module) {
  createAdmin();
}
