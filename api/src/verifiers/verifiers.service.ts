import { Injectable } from '@nestjs/common';

export interface InvitationDto {
  id: string;
  email: string;
  vaultId: string;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class VerifiersService {
  private readonly invitations = new Map<string, InvitationDto>();

  /**
   * Creates a new invitation for a verifier to join a vault.
   * In the real system this would send an email or SMS to the invitee with a secure token.
   */
  createInvitation(email: string, vaultId: string, expiresInHours = 168): InvitationDto {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const invitation: InvitationDto = {
      id,
      email,
      vaultId,
      expiresAt,
      createdAt: new Date(),
    };
    this.invitations.set(id, invitation);
    return invitation;
  }

  listInvitations(): InvitationDto[] {
    return Array.from(this.invitations.values());
  }
}