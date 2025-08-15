import { Controller, Get, Post, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { AssignRecipientDto } from './dto/assign-recipient.dto';
import { CurrentUserId } from '../common/current-user.decorator';

@ApiTags('blocks')
@ApiBearerAuth()
@Controller('blocks')
export class BlocksController {
  constructor(private readonly service: BlocksService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query('vault_id') vaultId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.list(userId, vaultId, cursor, Number(limit) || 50);
  }

  @Get(':id')
  get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.service.get(userId, id);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateBlockDto) {
    return this.service.create(userId, dto);
  }

  @Delete(':id')
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.service.softDelete(userId, id);
    return { status: 'ok' };
  }

  @Get(':id/recipients')
  @ApiOperation({ summary: 'List recipients assigned to a block' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listRecipients(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listRecipients(userId, id);
  }

  @Post(':id/recipients')
  @ApiOperation({ summary: 'Assign a recipient to a block' })
  @ApiParam({ name: 'id', format: 'uuid' })
  assignRecipient(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRecipientDto,
  ) {
    return this.service.assignRecipient(userId, id, dto);
  }
}
