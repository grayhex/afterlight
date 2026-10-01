import { describe, it, expect, jest } from '@jest/globals';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { VerifiedEmailGuard } from '../../src/auth/guards/verified-email.guard.js';

const ctx = (user: any) => ({
  getHandler: () => 'h',
  getClass: () => 'c',
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
}) as any;

function make(required: boolean, row: any) {
  const reflector: any = { getAllAndOverride: jest.fn(() => required) };
  const prisma: any = { user: { findUnique: jest.fn(async () => row) } };
  return { guard: new VerifiedEmailGuard(reflector, prisma), prisma };
}

describe('VerifiedEmailGuard', () => {
  it('lets unmarked routes through without a query', async () => {
    const { guard, prisma } = make(false, null);
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an unverified address with 403 and a missing account with 401', async () => {
    await expect(make(true, { emailVerifiedAt: null }).guard.canActivate(ctx({ sub: 'u1' }))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(make(true, null).guard.canActivate(ctx({ sub: 'u1' }))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(make(true, { emailVerifiedAt: new Date() }).guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a verified address, reading the state from the database and not from the token', async () => {
    const { guard, prisma } = make(true, { emailVerifiedAt: new Date() });
    await expect(guard.canActivate(ctx({ sub: 'u1', email_verified: false }))).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: { emailVerifiedAt: true } });
  });
});
