import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecoveryShareDto } from './dto/create-recovery-share.dto';
import { UpdateRecoveryShareDto } from './dto/update-recovery-share.dto';

@Injectable()
export class RecoverySharesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.recoveryShare.findMany();
  }

  get(id: string) {
    return this.prisma.recoveryShare.findUnique({ where: { id } });
  }

  create(dto: CreateRecoveryShareDto) {
    return this.prisma.recoveryShare.create({ data: dto });
  }

  update(id: string, dto: UpdateRecoveryShareDto) {
    return this.prisma.recoveryShare.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.recoveryShare.delete({ where: { id } });
  }
}
