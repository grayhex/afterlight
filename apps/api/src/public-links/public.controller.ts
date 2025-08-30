import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { PublicLinksService } from './public-links.service';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

@ApiTags('public')
@ApiExcludeController()
@ApiErrorResponses()
@Controller('p')
export class PublicAccessController {
  constructor(private readonly service: PublicLinksService) {}

  @Get(':token')
  async view(@Param('token') token: string) {
    const data = await this.service.resolveByToken(token);
    if (!data) throw new NotFoundException();
    return data;
  }
}
