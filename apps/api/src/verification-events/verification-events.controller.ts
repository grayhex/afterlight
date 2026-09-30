import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VerificationEventsService } from './verification-events.service.js';
import { StartVerificationEventDto } from './dto/start-event.dto.js';
import { VerificationDecisionDto } from './dto/decision.dto.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator.js';

@ApiTags('verification-events')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('verification-events')
export class VerificationEventsController {
  constructor(private readonly service: VerificationEventsService) {}

  @Get()
  @ApiQuery({ name: 'vault_id', required: false, description: 'Без vault_id — события доступных вам сейфов' })
  @ApiQuery({ name: 'as', required: false, enum: ['verifier'], description: 'verifier — только сейфы, где вы активный верификатор' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('vault_id', new ParseUUIDPipe({ optional: true })) vaultId?: string,
    @Query('as') asRole?: string,
  ) {
    return this.service.list(user.sub, vaultId, asRole);
  }

  @Post()
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartVerificationEventDto) {
    return this.service.start(user.sub, dto.vault_id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user.sub, id);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerificationDecisionDto,
  ) {
    return this.service.decide(user.sub, id, 'Confirm', dto.signature);
  }

  @Post(':id/deny')
  deny(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerificationDecisionDto,
  ) {
    return this.service.decide(user.sub, id, 'Deny', dto.signature);
  }
}
