import { UsersService } from '../src/users/users.service';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const sampleUser = {
  id: 'u1',
  email: 'test@example.com',
  phone: '123',
  passwordHash: 'hash',
  passkeyPub: 'pub',
  twoFaEnabled: true,
  role: 'User',
  locale: 'ru-RU',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('UsersService', () => {
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(async () => [sampleUser as any]),
        findUnique: jest.fn(async () => sampleUser as any),
        create: jest.fn(async ({ data }) => ({ ...sampleUser, ...data })),
      },
    } as any;
    service = new UsersService(prisma);
  });

  it('omits sensitive fields on list', async () => {
    const res = await service.list();
    expect(res[0]).not.toHaveProperty('passwordHash');
    expect(res[0]).not.toHaveProperty('passkeyPub');
  });

  it('omits sensitive fields on get', async () => {
    const res = await service.get('u1');
    expect(res).not.toHaveProperty('passwordHash');
    expect(res).not.toHaveProperty('passkeyPub');
  });
});
