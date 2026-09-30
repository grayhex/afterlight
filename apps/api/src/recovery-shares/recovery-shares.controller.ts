import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecoverySharesService } from './recovery-shares.service.js';
import { CreateRecoveryShareDto } from './dto/create-recovery-share.dto.js';
import { UpdateRecoveryShareDto } from './dto/update-recovery-share.dto.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator.js';

@ApiTags('recovery-shares')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('recovery-shares')
export class RecoverySharesController {
  constructor(private readonly service: RecoverySharesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('vault_id', ParseUUIDPipe) vaultId: string) {
    return this.service.list(user.sub, vaultId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecoveryShareDto) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecoveryShareDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.sub, id);
  }
}
