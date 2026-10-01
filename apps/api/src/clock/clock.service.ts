import { Injectable } from '@nestjs/common';

/**
 * Единый источник времени для доменной логики. В production всегда системные часы.
 * Управляемое время (setNow/advance) доступно только при NODE_ENV=test — для проверок deadline'ов в integration-тестах;
 * production не получает ни метода, ни endpoint'а для ускорения grace.
 */
@Injectable()
export class ClockService {
  private fixed: Date | null = null;

  now(): Date {
    return this.fixed ? new Date(this.fixed) : new Date();
  }

  private assertTest() {
    if (process.env.NODE_ENV !== 'test') throw new Error('Managed time is available only in the test environment');
  }

  setNow(date: Date) {
    this.assertTest();
    this.fixed = new Date(date);
  }

  advance(ms: number) {
    this.assertTest();
    this.fixed = new Date(this.now().getTime() + ms);
  }

  reset() {
    this.assertTest();
    this.fixed = null;
  }
}
