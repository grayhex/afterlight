import { Controller, Get, Post, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { AssignRecipientDto } from './dto/assign-recipient.dto';
import { CurrentUser } from '../common/current-user.decorator';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

@ApiTags('blocks')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('blocks')
export class BlocksController {
  constructor(private readonly service: BlocksService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('vault_id') vaultId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.list(user.sub, vaultId, cursor, Number(limit) || 50);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.get(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateBlockDto) {
    return this.service.create(user.sub, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    await this.service.softDelete(user.sub, id);
    return { status: 'ok' };
  }

  @Get(':id/recipients')
  @ApiOperation({ summary: 'List recipients assigned to a block' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listRecipients(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listRecipients(user.sub, id);
  }

  @Post(':id/recipients')
  @ApiOperation({ summary: 'Assign a recipient to a block' })
  @ApiParam({ name: 'id', format: 'uuid' })
  assignRecipient(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRecipientDto,
  ) {
    return this.service.assignRecipient(user.sub, id, dto);
  }
}
