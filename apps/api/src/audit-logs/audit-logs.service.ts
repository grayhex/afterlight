import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.auditLog.findMany({ orderBy: { ts: 'desc' }, take: 500 });
  }

  get(id: string) {
    return this.prisma.auditLog.findUnique({ where: { id } });
  }
}
