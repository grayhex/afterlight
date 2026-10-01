import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { loadMailConfig } from './mail.config.js';

/**
 * Фоновая отправка очереди: повторные попытки и восстановление после перезапуска (состояние — в БД).
 * В NODE_ENV=test выключена: тесты вызывают dispatchDue явно. MAIL_DISPATCH_INTERVAL_MS=0 тоже выключает.
 */
@Injectable()
export class NotificationsProcessor implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private notifications: NotificationsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const interval = loadMailConfig().dispatchIntervalMs;
    if (interval <= 0) return;
    this.timer = setInterval(() => this.notifications.dispatchSoon(), interval);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
