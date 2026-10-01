import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service.js';

/**
 * Простой фоновый worker в процессе API. Состояние таймеров лежит в БД (graceUntil/disputedUntil), поэтому перезапуск
 * ничего не теряет; обработка идемпотентна и безопасна при нескольких экземплярах (блокировка строки, SKIP LOCKED).
 * В тестовом окружении (NODE_ENV=test) периодический запуск выключен: тесты вызывают processTimers явно.
 */
@Injectable()
export class OrchestratorProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrchestratorProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private initial: NodeJS.Timeout | null = null;

  constructor(private orchestrator: OrchestratorService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => this.tick().catch((e) => this.logger.error(e)), 60 * 1000);
    this.initial = setTimeout(() => this.tick().catch((e) => this.logger.error(e)), 10 * 1000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.initial) clearTimeout(this.initial);
  }

  private async tick() {
    const res = await this.orchestrator.processTimers();
    if (res.finalized || res.rejected) {
      this.logger.log(`Sweep: finalized=${res.finalized} rejected=${res.rejected}`);
    }
  }
}
