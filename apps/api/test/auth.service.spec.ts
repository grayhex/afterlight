import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from '../src/auth/auth.service';
import { createHash } from 'crypto';

describe('AuthService password reset flow', () => {
  let prisma: any;
  let notifications: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', email: 'user@example.com' })),
        update: jest.fn(async (args: { data: any }) => ({ id: 'user-1', ...args.data })),
      },
      vault: {
        findFirst: jest.fn(async () => ({ id: 'vault-1' })),
      },
      passwordResetToken: {
        deleteMany: jest.fn(async () => ({ count: 1 })),
        create: jest.fn(async ({ data }) => ({ id: 'token-1', ...data })),
        findFirst: jest.fn(),
        delete: jest.fn(async () => ({})),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => {
        await callback({
          user: { update: prisma.user.update },
          passwordResetToken: {
            delete: prisma.passwordResetToken.delete,
          },
        });
      }),
    };

    notifications = {
      enqueueEmail: jest.fn(async () => ({})),
      flushEmailQueue: jest.fn(async () => ({})),
    };

    service = new AuthService(prisma, notifications);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('persists hashed reset token and queues email with raw token', async () => {
    const emailPayloads: any[] = [];
    notifications.enqueueEmail.mockImplementation(
      async (_vaultId: string, _to: string, payload: any) => {
        emailPayloads.push(payload);
        return {};
      },
    );

    let createdTokenData: any = null;
    prisma.passwordResetToken.create.mockImplementation(async ({ data }: { data: any }) => {
      createdTokenData = data;
      return { id: 'token-1', ...data };
    });

    await service.forgotPassword('user@example.com');

    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(createdTokenData).not.toBeNull();
    expect(createdTokenData.userId).toBe('user-1');
    expect(createdTokenData.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createdTokenData.expiresAt).toBeInstanceOf(Date);

    expect(notifications.enqueueEmail).toHaveBeenCalledTimes(1);
    const payload = emailPayloads[0];
    expect(payload.subject).toContain('восстановление пароля');
    const tokenMatch = payload.text?.match(/[0-9a-f]{64}/i);
    expect(tokenMatch).not.toBeNull();
    const tokenFromEmail = tokenMatch![0];
    const hashed = createHash('sha256').update(tokenFromEmail).digest('hex');
    expect(hashed).toBe(createdTokenData.tokenHash);
    expect(notifications.flushEmailQueue).toHaveBeenCalled();
  });

  it('resets password and removes token when hash matches an active record', async () => {
    const rawToken = 'abcd'.repeat(16);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.resetPassword(rawToken, 'newPassword123');

    expect(result).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ passwordHash: expect.stringContaining(':') }),
    });
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 'token-1' } });
  });

  it('returns false when token is missing or expired', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue(null);

    const result = await service.resetPassword('invalid', 'password');

    expect(result).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.delete).not.toHaveBeenCalled();
  });
});
