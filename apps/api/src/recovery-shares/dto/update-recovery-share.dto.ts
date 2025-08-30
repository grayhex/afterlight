import { PartialType } from '@nestjs/swagger';
import { CreateRecoveryShareDto } from './create-recovery-share.dto';

export class UpdateRecoveryShareDto extends PartialType(CreateRecoveryShareDto) {}
