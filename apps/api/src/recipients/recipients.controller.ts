import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecipientsService } from './recipients.service';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { SearchRecipientsDto } from './dto/search-recipients.dto';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';

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
