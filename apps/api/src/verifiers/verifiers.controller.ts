import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { VerifiersService } from './verifiers.service';
import { InviteVerifierDto } from './dto/invite-verifier.dto';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

@ApiTags('verifiers')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('verifiers')
export class VerifiersController {
  constructor(private readonly service: VerifiersService) {}

  @Get()
  list(@Query('vault_id') vaultId: string) {
    return this.service.listByVault(vaultId);
  }

  @Post('invitations')
  invite(@Body() dto: InviteVerifierDto) {
    const token = randomBytes(24).toString('hex');
    return this.service.invite(dto, token);
  }

  @Post('invitations/:vaultId/:verifierId/accept')
  accept(@Param('vaultId') vaultId: string, @Param('verifierId') verifierId: string) {
    return this.service.acceptInvitation(vaultId, verifierId);
  }
}
