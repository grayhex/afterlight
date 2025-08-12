import { Body, Controller, Get, Post } from '@nestjs/common';
import { VerifiersService, InvitationDto } from './verifiers.service';

interface CreateInvitationRequest {
  email: string;
  vaultId: string;
  expiresInHours?: number;
}

@Controller('verifiers')
export class VerifiersController {
  constructor(private readonly verifiersService: VerifiersService) {}

  /**
   * Lists all created invitations. This is purely for demo and would normally be restricted.
   */
  @Get('invitations')
  listInvitations(): InvitationDto[] {
    return this.verifiersService.listInvitations();
  }

  /**
   * Creates an invitation for a verifier to register on the platform and be associated with a vault.
   */
  @Post('invitations')
  createInvitation(@Body() body: CreateInvitationRequest): InvitationDto {
    const { email, vaultId, expiresInHours } = body;
    return this.verifiersService.createInvitation(email, vaultId, expiresInHours);
  }
}