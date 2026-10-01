import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Query, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { VaultsService } from './vaults.service.js';
import { CreateVaultDto } from './dto/create-vault.dto.js';
import { UpdateVaultSettingsDto } from './dto/update-vault-settings.dto.js';
import { SetVaultKeyDto } from './dto/set-vault-key.dto.js';
import { VaultKeyDto } from './dto/vault-key.dto.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';
import { RequireVerifiedEmail } from '../auth/decorators/require-verified-email.decorator.js';

@ApiTags('vaults')
@ApiBearerAuth()
@ApiErrorResponses()
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
  get(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getForUser(user.sub, id);
  }

  @RequireVerifiedEmail()
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateVaultDto) {
    return this.service.createForUser(user.sub, dto);
  }

  @Put(':id/key')
  @ApiOperation({ summary: 'Set the vault key wrapped under the owner recovery code (once; the key is created in the browser)' })
  @ApiOkResponse({ type: VaultKeyDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  setKey(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetVaultKeyDto,
  ) {
    return this.service.setKey(user.sub, id, dto);
  }

  @Patch(':id/settings')
  updateSettings(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVaultSettingsDto,
  ) {
    return this.service.updateSettings(user.sub, id, dto);
  }
}
