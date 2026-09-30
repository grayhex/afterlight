import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecipientsService } from './recipients.service.js';
import { CreateRecipientDto } from './dto/create-recipient.dto.js';
import { SearchRecipientsDto } from './dto/search-recipients.dto.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator.js';

@ApiTags('recipients')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('recipients')
export class RecipientsController {
  constructor(private readonly service: RecipientsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecipientDto) {
    return this.service.createOrGet(user, dto);
  }

  @Get()
  search(@CurrentUser() user: AuthenticatedUser, @Query() q: SearchRecipientsDto) {
    return this.service.search(user, q.vault_id, q.q);
  }
}
