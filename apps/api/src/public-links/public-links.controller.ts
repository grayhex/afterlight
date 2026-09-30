import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PublicLinksService } from './public-links.service.js';
import { UpdatePublicLinkDto } from './dto/update-public-link.dto.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';

@ApiTags('public-links')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('blocks/:id/public')
export class PublicLinksController {
  constructor(private readonly service: PublicLinksService) {}

  @Get()
  get(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) blockId: string) {
    return this.service.getForBlock(user.sub, blockId);
  }

  @Put()
  upsert(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) blockId: string, @Body() dto: UpdatePublicLinkDto) {
    return this.service.upsert(user.sub, blockId, dto);
  }

  @Delete()
  disable(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) blockId: string) {
    return this.service.disable(user.sub, blockId);
  }
}
