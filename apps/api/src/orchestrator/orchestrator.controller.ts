import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrchestratorService } from './orchestrator.service';
import { StartEventDto } from './dto/start-event.dto';
import { DecisionDto } from './dto/decision.dto';
import { CurrentUserId } from '../common/current-user.decorator';

@ApiTags('orchestrator')
@ApiBearerAuth()
@Controller('orchestration')
export class OrchestratorController {
  constructor(private readonly svc: OrchestratorService) {}

  @Post('start')
  start(@CurrentUserId() userId: string, @Body() dto: StartEventDto) {
    return this.svc.start(userId, dto.vault_id);
  }

  @Post('decision')
  decide(@CurrentUserId() _userId: string, @Body() dto: DecisionDto) {
    return this.svc.decide(dto.vault_id, dto.verifier_id, dto.decision, dto.signature);
  }
}
