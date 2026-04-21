import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { VerifiersService } from './verifiers.service';
import { InviteVerifierDto } from './dto/invite-verifier.dto';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';

@ApiTags('verifiers')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('verifiers')
export class VerifiersController {
  constructor(private readonly service: VerifiersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('vault_id') vaultId: string) {
    return this.service.listByVault(user, vaultId);
  }

  @Post('invitations')
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteVerifierDto) {
    const token = randomBytes(24).toString('hex');
    return this.service.invite(user, dto, token);
  }

  @Post('invitations/:vaultId/:userId/accept')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vaultId') vaultId: string,
    @Param('userId') userId: string,
  ) {
    return this.service.acceptInvitation(user, vaultId, userId);
  }
}
