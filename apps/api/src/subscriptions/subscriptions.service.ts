import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.subscription.findMany();
  }

  get(id: string) {
    return this.prisma.subscription.findUnique({ where: { id } });
  }

  create(dto: CreateSubscriptionDto) {
    return this.prisma.subscription.create({
      data: {
        userId: dto.userId,
        planId: dto.planId,
        status: dto.status,
        currentPeriodEnd: new Date(dto.currentPeriodEnd),
      },
    });
  }

  update(id: string, dto: UpdateSubscriptionDto) {
    const data: any = { ...dto };
    if (dto.currentPeriodEnd) {
      data.currentPeriodEnd = new Date(dto.currentPeriodEnd);
    }
    return this.prisma.subscription.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.subscription.delete({ where: { id } });
  }
}
