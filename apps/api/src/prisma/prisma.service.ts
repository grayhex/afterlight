import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { prismaClientOptions } from './prisma-options';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super(prismaClientOptions());
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  enableShutdownHooks(app: INestApplication) {
    // close Nest on process exit
    process.on('beforeExit', async () => {
      await app.close();
    });

    // handle termination signals from orchestrators
    process.on('SIGINT', async () => {
      await app.close();
    });
    process.on('SIGTERM', async () => {
      await app.close();
    });
  }
}
