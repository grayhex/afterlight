import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.auditLog.findMany({ orderBy: { ts: 'desc' }, take: 500 });
  }

  async get(id: string) {
    const entry = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Audit log entry not found');
    return entry;
  }
}
