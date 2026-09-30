import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuditLogsService } from './audit-logs.service.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

// Журнал аудита только для чтения и только для администратора платформы: записи пишет сервер,
// создавать, менять или удалять их через API нельзя.
@ApiTags('audit-logs')
@ApiBearerAuth()
@ApiErrorResponses()
@Roles(UserRole.Admin)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
}
