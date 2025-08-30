import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

@ApiTags('health')
@ApiErrorResponses()
@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

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
  async readyz(@Res({ passthrough: true }) res: Response) {
    const timeoutMs = 3000;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs),
        ),
      ]);
      return { status: 'ready' };
    } catch (e) {
      this.logger.error('Readiness check failed', e as Error);
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'not_ready' };
    }
  }
}
