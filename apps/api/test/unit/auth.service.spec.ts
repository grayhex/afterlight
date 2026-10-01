import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from '../../src/auth/auth.service.js';
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
      $queryRaw: jest.fn(async () => []),
      notification: { count: jest.fn(async () => 0) },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => {
        return callback({
          $queryRaw: prisma.$queryRaw,
          notification: { count: prisma.notification.count },
          user: { update: prisma.user.update },
          passwordResetToken: {
            delete: prisma.passwordResetToken.delete,
            deleteMany: prisma.passwordResetToken.deleteMany,
            create: prisma.passwordResetToken.create,
            findFirst: prisma.passwordResetToken.findFirst,
          },
        });
      }),
    };

    notifications = {
      sendPasswordReset: jest.fn(async () => undefined),
      dispatchSoon: jest.fn(),
      cancelQueued: jest.fn(async () => undefined),
    };

    service = new AuthService(prisma, notifications, { now: () => new Date() } as any, { cancelOnOwnerActivity: jest.fn() } as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('persists the hashed reset token and queues the email with the raw token in one transaction, without needing a vault', async () => {
    let createdTokenData: any = null;
    prisma.passwordResetToken.create.mockImplementation(async ({ data }: { data: any }) => {
      createdTokenData = data;
      return { id: 'token-1', ...data };
    });

    await service.forgotPassword('user@example.com');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1); // блокировка строки пользователя сериализует параллельные запросы
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(createdTokenData.userId).toBe('user-1');
    expect(createdTokenData.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createdTokenData.expiresAt).toBeInstanceOf(Date);

    expect(notifications.sendPasswordReset).toHaveBeenCalledTimes(1);
    const [to, rawToken, userId, expiresAt, tx] = notifications.sendPasswordReset.mock.calls[0];
    expect(to).toBe('user@example.com');
    expect(userId).toBe('user-1');
    expect(expiresAt).toBe(createdTokenData.expiresAt); // письмо живёт не дольше токена
    expect(tx).toBeDefined(); // письмо ставится в очередь в той же транзакции, что и токен
    expect(createHash('sha256').update(rawToken).digest('hex')).toBe(createdTokenData.tokenHash);
    expect(prisma.vault.findFirst).not.toHaveBeenCalled();
    expect(notifications.dispatchSoon).toHaveBeenCalled();
  });

  it('a request inside the cooldown or above the hourly cap creates neither a token nor a mail', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValueOnce({ id: 'recent' }); // токен создан только что
    await service.forgotPassword('user@example.com');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(notifications.sendPasswordReset).not.toHaveBeenCalled();
    expect(notifications.dispatchSoon).not.toHaveBeenCalled();

    prisma.notification.count.mockResolvedValueOnce(5); // потолок в час исчерпан
    await service.forgotPassword('user@example.com');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(notifications.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown address (no token, no mail)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await service.forgotPassword('nobody@example.com');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(notifications.sendPasswordReset).not.toHaveBeenCalled();
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
    // израсходованный токен: ожидающее повтора письмо с ним снимается в той же транзакции
    expect(notifications.cancelQueued).toHaveBeenCalledWith('password_reset', 'user-1', 'token consumed', expect.anything());
  });

  it('returns false when token is missing or expired', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue(null);

    const result = await service.resetPassword('invalid', 'password');

    expect(result).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.delete).not.toHaveBeenCalled();
  });
});
