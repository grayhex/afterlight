import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PublicLinksService } from './public-links.service';
import { UpdatePublicLinkDto } from './dto/update-public-link.dto';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('public-links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('blocks/:id/public')
export class PublicLinksController {
  constructor(private readonly service: PublicLinksService) {}

  @Get()
  get(@CurrentUser() user: any, @Param('id') blockId: string) {
    return this.service.getForBlock(user.sub, blockId);
  }

  @Put()
  upsert(@CurrentUser() user: any, @Param('id') blockId: string, @Body() dto: UpdatePublicLinkDto) {
    return this.service.upsert(user.sub, blockId, dto);
  }

  @Delete()
  disable(@CurrentUser() user: any, @Param('id') blockId: string) {
    return this.service.disable(user.sub, blockId);
  }
}
