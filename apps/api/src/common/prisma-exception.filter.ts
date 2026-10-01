import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Ошибки базы, которые означают «клиент обратился к несуществующему/конфликтующему объекту», а не сбой сервера, отдаются
 * как 4xx без текста Prisma (в нём бывают имена таблиц и значения). Остальные ошибки Prisma остаются 500 и попадают в лог.
 */
const MAP: Record<string, { status: number; message: string }> = {
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Not found' }, // запись для update/delete не найдена
  P2002: { status: HttpStatus.CONFLICT, message: 'Conflict' }, // нарушена уникальность
  P2003: { status: HttpStatus.CONFLICT, message: 'Conflict' }, // нарушена связь (внешний ключ)
  P2007: { status: HttpStatus.BAD_REQUEST, message: 'Invalid input' }, // значение не того формата
  P2023: { status: HttpStatus.BAD_REQUEST, message: 'Invalid input' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const known = MAP[error.code];
    const mapped = known ?? { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    if (!known) {
      // Ответ мы пишем сами, поэтому стандартный обработчик Nest исключение не увидит: без этой записи сбой базы
      // (пул соединений, недоступность) был бы невиден в логах. В запись — только код и модель: текст Prisma содержит запросы и значения.
      const model = typeof error.meta?.modelName === 'string' ? error.meta.modelName : 'unknown';
      this.logger.error(`Unmapped database error code=${error.code} model=${model}`);
    }
    res.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
  }
}
