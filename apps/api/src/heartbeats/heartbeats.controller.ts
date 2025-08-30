import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HeartbeatsService } from './heartbeats.service';
import { UpdateHeartbeatDto } from './dto/update-heartbeat.dto';
import { HeartbeatPingDto } from './dto/ping.dto';
import { CurrentUser } from '../common/current-user.decorator';

@ApiTags('heartbeats')
@ApiBearerAuth()
@Controller()
export class HeartbeatsController {
  constructor(private readonly service: HeartbeatsService) {}

  @Get('vaults/:vaultId/heartbeat')
  getConfig(@CurrentUser() user: any, @Param('vaultId') vaultId: string) {
    return this.service.getConfig(user.sub, vaultId);
  }

  @Patch('vaults/:vaultId/heartbeat')
  updateConfig(
    @CurrentUser() user: any,
    @Param('vaultId') vaultId: string,
    @Body() dto: UpdateHeartbeatDto,
  ) {
    return this.service.updateConfig(user.sub, vaultId, dto);
  }

  @Post('heartbeats/ping')
  ping(@CurrentUser() user: any, @Body() dto: HeartbeatPingDto) {
    return this.service.ping(user.sub, dto.vault_id, dto.method);
  }
}
