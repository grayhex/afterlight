import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VaultsService } from './vaults.service';
import { CreateVaultDto } from './dto/create-vault.dto';
import { UpdateVaultSettingsDto } from './dto/update-vault-settings.dto';
import { CurrentUser } from '../common/current-user.decorator';

@ApiTags('vaults')
@ApiBearerAuth()
@Controller('vaults')
export class VaultsController {
  constructor(private readonly service: VaultsService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.listForUser(user.sub, cursor, Number(limit) || 50);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getForUser(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateVaultDto) {
    return this.service.createForUser(user.sub, dto);
  }

  @Patch(':id/settings')
  updateSettings(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateVaultSettingsDto,
  ) {
    return this.service.updateSettings(user.sub, id, dto);
  }
}
