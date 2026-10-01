import { Controller, Get, Post, Delete, Body, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { VerifiersService } from './verifiers.service.js';
import { InviteVerifierDto } from './dto/invite-verifier.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { InvitationCreatedDto, InvitationPreviewDto, VerifierMemberDto } from './dto/verifier-member.dto.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequireVerifiedEmail } from '../auth/decorators/require-verified-email.decorator.js';

@ApiTags('verifiers')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('verifiers')
export class VerifiersController {
  constructor(private readonly service: VerifiersService) {}

  @Get()
  @ApiOkResponse({ type: VerifierMemberDto, isArray: true })
  list(@CurrentUser() user: AuthenticatedUser, @Query('vault_id', ParseUUIDPipe) vaultId: string) {
    return this.service.listByVault(user, vaultId);
  }

  @Post('invitations')
  @ApiCreatedResponse({ type: InvitationCreatedDto })
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteVerifierDto) {
    return this.service.invite(user, dto);
  }

  @Public()
  @Post('invitations/preview')
  @ApiCreatedResponse({ type: InvitationPreviewDto })
  preview(@Body() dto: AcceptInvitationDto) {
    return this.service.previewInvitation(dto.token);
  }

  @RequireVerifiedEmail()
  @Post('invitations/accept')
  @ApiCreatedResponse({ type: VerifierMemberDto })
  accept(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcceptInvitationDto) {
    return this.service.acceptInvitation(user, dto.token);
  }

  @Delete('invitations/:invitationId')
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.service.revokeInvitation(user, invitationId);
  }

  @Post(':vaultId/:userId/revoke')
  revokeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.revokeMember(user, vaultId, userId);
  }
}
