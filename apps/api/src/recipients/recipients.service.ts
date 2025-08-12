import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipientDto } from './dto/create-recipient.dto';

@Injectable()
export class RecipientsService {
  constructor(private prisma: PrismaService) {}

  async createOrGet(dto: CreateRecipientDto) {
    const r = await this.prisma.recipient.upsert({
      where: { contact: dto.contact },
      update: { pubkey: dto.pubkey ?? undefined },
      create: { contact: dto.contact, pubkey: dto.pubkey ?? null, verificationStatus: 'Invited' as any },
    });
    return r;
  }

  async search(query?: string) {
    const where = query
      ? { contact: { contains: query, mode: 'insensitive' as const } }
      : {};
    return this.prisma.recipient.findMany({ where, take: 20, orderBy: { createdAt: 'desc' } });
  }
}
