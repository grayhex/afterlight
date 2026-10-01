import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { loadMailConfig } from './mail.config.js';

/**
 * Фоновая отправка очереди: повторные попытки и восстановление после перезапуска (состояние — в БД).
 * В NODE_ENV=test выключена: тесты вызывают dispatchDue явно. MAIL_DISPATCH_INTERVAL_MS=0 тоже выключает.
 */
@Injectable()
export class NotificationsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private notifications: NotificationsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const interval = loadMailConfig().dispatchIntervalMs;
    if (interval <= 0) return;
    this.timer = setInterval(() => void this.tick(), interval);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // предыдущий проход ещё идёт
    this.running = true;
    try {
      const res = await this.notifications.dispatchDue();
      if (res.claimed) this.logger.log(`[Email] dispatch: sent=${res.sent} retried=${res.retried} failed=${res.failed}`);
    } catch (e) {
      this.logger.error(`[Email] dispatch tick failed: ${String(e)}`);
    } finally {
      this.running = false;
    }
  }
}
