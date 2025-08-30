import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.plan.findMany();
  }

  get(id: string) {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  create(dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: { tier: dto.tier, limits: dto.limits ?? {} } });
  }

  update(id: string, dto: UpdatePlanDto) {
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.plan.delete({ where: { id } });
  }
}
