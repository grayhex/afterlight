import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { UpdateAuditLogDto } from './dto/update-audit-log.dto';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.auditLog.findMany({ orderBy: { ts: 'desc' } });
  }

  get(id: string) {
    return this.prisma.auditLog.findUnique({ where: { id } });
  }

  create(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({ data: dto });
  }

  update(id: string, dto: UpdateAuditLogDto) {
    return this.prisma.auditLog.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.auditLog.delete({ where: { id } });
  }
}
