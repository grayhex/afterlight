import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrchestratorService } from './orchestrator.service.js';
import { StartEventDto } from './dto/start-event.dto.js';
import { OrchestratorDecisionDto } from './dto/decision.dto.js';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';

@ApiTags('orchestrator')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('orchestration')
export class OrchestratorController {
  constructor(private readonly svc: OrchestratorService) {}

  @Post('start')
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartEventDto) {
    return this.svc.start(user.sub, dto.vault_id);
  }

  /** D3: владелец отменяет процесс («Я жив») в любом активном состоянии до Finalized. */
  @Post('cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartEventDto) {
    return this.svc.cancel(user.sub, dto.vault_id);
  }

  @Post('decision')
  decide(@CurrentUser() user: AuthenticatedUser, @Body() dto: OrchestratorDecisionDto) {
    return this.svc.decide(user.sub, dto.vault_id, dto.decision, dto.signature);
  }
}
