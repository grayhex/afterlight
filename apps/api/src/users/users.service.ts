import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private toDto(user: User): UserDto {
    const { passwordHash, passkeyPub, phone, ...data } = user;
    return { ...data, ...(phone ? { phone } : {}) };
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
    const user = await this.prisma.user.create({ data: dto });
    return this.toDto(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    return this.toDto(user);
  }

  async remove(id: string): Promise<UserDto> {
    const user = await this.prisma.user.delete({ where: { id } });
    return this.toDto(user);
  }
}
