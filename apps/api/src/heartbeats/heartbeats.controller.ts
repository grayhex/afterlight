import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HeartbeatsService } from './heartbeats.service';
import { UpdateHeartbeatDto } from './dto/update-heartbeat.dto';
import { HeartbeatPingDto } from './dto/ping.dto';
import { CurrentUserId } from '../common/current-user.decorator';

@ApiTags('heartbeats')
@ApiBearerAuth()
@Controller()
export class HeartbeatsController {
  constructor(private readonly service: HeartbeatsService) {}

  @Get('vaults/:vaultId/heartbeat')
  getConfig(@CurrentUserId() userId: string, @Param('vaultId') vaultId: string) {
    return this.service.getConfig(userId, vaultId);
  }

  @Patch('vaults/:vaultId/heartbeat')
  updateConfig(
    @CurrentUserId() userId: string,
    @Param('vaultId') vaultId: string,
    @Body() dto: UpdateHeartbeatDto,
  ) {
    return this.service.updateConfig(userId, vaultId, dto);
  }

  @Post('heartbeats/ping')
  ping(@CurrentUserId() userId: string, @Body() dto: HeartbeatPingDto) {
    return this.service.ping(userId, dto.vault_id, dto.method);
  }
}
