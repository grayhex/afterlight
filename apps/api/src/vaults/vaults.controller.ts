import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VaultsService } from './vaults.service';
import { CreateVaultDto } from './dto/create-vault.dto';
import { UpdateVaultSettingsDto } from './dto/update-vault-settings.dto';
import { CurrentUserId } from '../common/current-user.decorator';

@ApiTags('vaults')
@ApiBearerAuth()
@Controller('vaults')
export class VaultsController {
  constructor(private readonly service: VaultsService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.listForUser(userId, cursor, Number(limit) || 50);
  }

  @Get(':id')
  get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.service.getForUser(userId, id);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateVaultDto) {
    return this.service.createForUser(userId, dto);
  }

  @Patch(':id/settings')
  updateSettings(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVaultSettingsDto,
  ) {
    return this.service.updateSettings(userId, id, dto);
  }
}
