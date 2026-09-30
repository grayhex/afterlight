import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrchestratorService } from './orchestrator.service';
import { StartEventDto } from './dto/start-event.dto';
import { DecisionDto } from './dto/decision.dto';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

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

  @Post('decision')
  decide(@CurrentUser() user: AuthenticatedUser, @Body() dto: DecisionDto) {
    return this.svc.decide(user.sub, dto.vault_id, dto.decision, dto.signature);
  }
}
