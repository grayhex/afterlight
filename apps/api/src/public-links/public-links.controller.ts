import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PublicLinksService } from './public-links.service';
import { UpdatePublicLinkDto } from './dto/update-public-link.dto';
import { CurrentUserId } from '../common/current-user.decorator';

@ApiTags('public-links')
@ApiBearerAuth()
@Controller('blocks/:id/public')
export class PublicLinksController {
  constructor(private readonly service: PublicLinksService) {}

  @Get()
  get(@CurrentUserId() userId: string, @Param('id') blockId: string) {
    return this.service.getForBlock(userId, blockId);
  }

  @Put()
  upsert(@CurrentUserId() userId: string, @Param('id') blockId: string, @Body() dto: UpdatePublicLinkDto) {
    return this.service.upsert(userId, blockId, dto);
  }

  @Delete()
  disable(@CurrentUserId() userId: string, @Param('id') blockId: string) {
    return this.service.disable(userId, blockId);
  }
}
