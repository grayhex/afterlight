import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('/healthz')
  async healthz() {
    return {
      status: 'ok',
      ts: new Date().toISOString(),
      uptime_sec: Math.round(process.uptime()),
    };
  }

  @Get('/readyz')
  async readyz() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (e) {
      return { status: 'not_ready', error: String(e) };
    }
  }
}
