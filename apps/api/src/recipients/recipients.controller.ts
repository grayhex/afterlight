import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RecipientsService } from './recipients.service.js';
import { CreateRecipientDto } from './dto/create-recipient.dto.js';
import { ClaimKeyDto, ClaimKeyResultDto } from './dto/claim-key.dto.js';
import { ConfirmKeyDto } from './dto/confirm-key.dto.js';
import { DeliveredBlockDto, DeliveryItemDto, ListDeliveriesDto } from './dto/delivery.dto.js';
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

  @Get('me/deliveries')
  @RequireVerifiedEmail()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Blocks that may be delivered to me now (only after the release event is finalized)' })
  @ApiOkResponse({ type: DeliveryItemDto, isArray: true })
  listDeliveries(@CurrentUser() user: AuthenticatedUser, @Query() q: ListDeliveriesDto) {
    return this.service.listDeliveries(user, q);
  }

  @Get('me/deliveries/:blockId')
  @RequireVerifiedEmail()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Ciphertext of a block and the data key wrapped for my confirmed key' })
  @ApiOkResponse({ type: DeliveredBlockDto })
  @ApiParam({ name: 'blockId', format: 'uuid' })
  getDelivery(@CurrentUser() user: AuthenticatedUser, @Param('blockId', ParseUUIDPipe) blockId: string) {
    return this.service.getDelivery(user, blockId);
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
