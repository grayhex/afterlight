import { Body, Controller, Get, Param, Patch, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HeartbeatsService } from './heartbeats.service.js';
import { UpdateHeartbeatDto } from './dto/update-heartbeat.dto.js';
import { HeartbeatPingDto } from './dto/ping.dto.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';

@ApiTags('heartbeats')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller()
export class HeartbeatsController {
  constructor(private readonly service: HeartbeatsService) {}

  @Get('vaults/:vaultId/heartbeat')
  getConfig(@CurrentUser() user: any, @Param('vaultId', ParseUUIDPipe) vaultId: string) {
    return this.service.getConfig(user.sub, vaultId);
  }

  @Patch('vaults/:vaultId/heartbeat')
  updateConfig(
    @CurrentUser() user: any,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Body() dto: UpdateHeartbeatDto,
  ) {
    return this.service.updateConfig(user.sub, vaultId, dto);
  }

  @Post('heartbeats/ping')
  ping(@CurrentUser() user: any, @Body() dto: HeartbeatPingDto) {
    return this.service.ping(user.sub, dto.vault_id, dto.method);
  }
}
