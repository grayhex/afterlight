import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecipientsService } from './recipients.service';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { SearchRecipientsDto } from './dto/search-recipients.dto';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

@ApiTags('recipients')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('recipients')
export class RecipientsController {
  constructor(private readonly service: RecipientsService) {}

  @Post()
  create(@Body() dto: CreateRecipientDto) {
    return this.service.createOrGet(dto);
  }

  @Get()
  search(@Query() q: SearchRecipientsDto) {
    return this.service.search(q.q);
  }
}
