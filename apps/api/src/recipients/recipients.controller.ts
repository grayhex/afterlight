import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RecipientsService } from './recipients.service.js';
import { CreateRecipientDto } from './dto/create-recipient.dto.js';
import { ClaimKeyDto, ClaimKeyResultDto } from './dto/claim-key.dto.js';
import { ConfirmKeyDto } from './dto/confirm-key.dto.js';
import { RecipientDto } from './dto/recipient.dto.js';
import { RequireVerifiedEmail } from '../auth/decorators/require-verified-email.decorator.js';
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
  @ApiCreatedResponse({ type: RecipientDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecipientDto) {
    return this.service.createOrGet(user, dto);
  }

  @Get()
  @ApiOkResponse({ type: RecipientDto, isArray: true })
  search(@CurrentUser() user: AuthenticatedUser, @Query() q: SearchRecipientsDto) {
    return this.service.search(user, q.vault_id, q.q);
  }

  // Путь фиксирован и стоит до ':id/...', чтобы не воспринимался как идентификатор
  @Put('me/key')
  @RequireVerifiedEmail()
  @ApiOkResponse({ type: ClaimKeyResultDto, description: 'Получатель заявляет свой публичный ключ для всех сейфов, где его адрес назначен получателем' })
  claimKey(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClaimKeyDto) {
    return this.service.claimKey(user, dto);
  }

  @Post(':id/confirm-key')
  @ApiCreatedResponse({ type: RecipientDto, description: 'Владелец подтверждает отпечаток ключа, сверенный с получателем вне сервера' })
  confirmKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmKeyDto,
  ) {
    return this.service.confirmKey(user, id, dto.key_fingerprint);
  }
}
