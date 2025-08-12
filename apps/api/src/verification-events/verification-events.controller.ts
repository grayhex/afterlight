import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VerificationEventsService } from './verification-events.service';
import { StartVerificationEventDto } from './dto/start-event.dto';
import { DecisionDto } from './dto/decision.dto';

@ApiTags('verification-events')
@ApiBearerAuth()
@Controller('verification-events')
export class VerificationEventsController {
  constructor(private readonly service: VerificationEventsService) {}

  @Get()
  list(@Query('vault_id') vaultId: string) {
    return this.service.listByVault(vaultId);
  }

  @Post()
  start(@Body() dto: StartVerificationEventDto) {
    return this.service.start(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/confirm/:verifierId')
  confirm(@Param('id') id: string, @Param('verifierId') verifierId: string, @Body() dto: DecisionDto) {
    return this.service.decide(id, verifierId, { ...dto, decision: 'Confirm' });
  }

  @Post(':id/deny/:verifierId')
  deny(@Param('id') id: string, @Param('verifierId') verifierId: string, @Body() dto: DecisionDto) {
    return this.service.decide(id, verifierId, { ...dto, decision: 'Deny' });
  }
}
