import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class DecisionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ format: 'uuid', description: 'ID верификатора (MVP: из тела запроса)' })
  @IsUUID()
  verifier_id!: string;

  @ApiProperty({ enum: ['Confirm', 'Deny'] })
  @IsIn(['Confirm', 'Deny'])
  decision!: 'Confirm' | 'Deny';

  @ApiProperty({ required: false })
  @IsOptional()
  signature?: string;
}
