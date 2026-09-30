import { PartialType } from '@nestjs/swagger';
import { CreateRecoveryShareDto } from './create-recovery-share.dto.js';

export class UpdateRecoveryShareDto extends PartialType(CreateRecoveryShareDto) {}
