import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VerifiersService } from './verifiers.service';
import { InviteVerifierDto } from './dto/invite-verifier.dto';

@ApiTags('verifiers')
@ApiBearerAuth()
@Controller('verifiers')
export class VerifiersController {
  constructor(private readonly service: VerifiersService) {}

  @Get()
  list(@Query('vault_id') vaultId: string) {
    return this.service.listByVault(vaultId);
  }

  @Post('invitations')
  invite(@Body() dto: InviteVerifierDto) {
    return this.service.invite(dto);
  }

  @Post('invitations/:vaultId/:verifierId/accept')
  accept(@Param('vaultId') vaultId: string, @Param('verifierId') verifierId: string) {
    return this.service.acceptInvitation(vaultId, verifierId);
  }
}
