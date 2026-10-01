import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Prisma, User } from '@prisma/client';
import { UserDto } from './dto/user.dto.js';
import { normalizeEmail } from '../common/email.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private toDto(user: User): UserDto {
    // Явный список полей (как UserDto): внутренние passwordHash, passkeyPub, sessionVersion и прочее наружу не попадают
    return {
      id: user.id,
      email: user.email,
      ...(user.phone ? { phone: user.phone } : {}),
      twoFaEnabled: user.twoFaEnabled,
      emailVerifiedAt: user.emailVerifiedAt,
      role: user.role,
      locale: user.locale,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async list(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany();
    return users.map((u) => this.toDto(u));
  }

  async get(id: string): Promise<UserDto | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toDto(user) : null;
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    // Адрес всегда в каноническом виде: вход и сброс ищут по нормализованному
    const user = await this.prisma.user.create({ data: { ...dto, ...(dto.email ? { email: normalizeEmail(dto.email) } : {}) } });
    return this.toDto(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const normalized = dto.email ? normalizeEmail(dto.email) : undefined;
    const user = await this.prisma.$transaction(async (tx) => {
      // Та же блокировка строки пользователя, что у выдачи токенов (forgot/resend): смена адреса и выдача токена идут по очереди
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "user" WHERE id = ${id}::uuid FOR UPDATE`);
      const current = normalized ? await tx.user.findUnique({ where: { id }, select: { email: true } }) : null;
      const changed = !!normalized && !!current && current.email !== normalized;
      const updated = await tx.user.update({
        where: { id },
        data: { ...dto, ...(normalized ? { email: normalized } : {}), ...(changed ? { emailVerifiedAt: null } : {}) },
      });
      if (changed) {
        // Новый адрес не наследует подтверждение прежнего, а токены и письма, выданные на прежний адрес, перестают работать:
        // иначе получатель старого письма мог бы подтвердить новый адрес или сбросить пароль
        await tx.emailVerificationToken.deleteMany({ where: { userId: id } });
        await tx.passwordResetToken.deleteMany({ where: { userId: id } });
        await tx.notification.updateMany({
          where: { kind: { in: ['email_verification', 'password_reset'] }, supersedeKey: id, state: 'Queued' },
          data: { state: 'Cancelled', lastError: 'address changed', lockedUntil: null, payload: { redacted: true } },
        });
      }
      return updated;
    });
    return this.toDto(user);
  }

  async remove(id: string): Promise<UserDto> {
    const user = await this.prisma.user.delete({ where: { id } });
    return this.toDto(user);
  }
}
