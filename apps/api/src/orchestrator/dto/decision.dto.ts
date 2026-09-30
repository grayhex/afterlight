import { ApiProperty } from '@nestjs/swagger';
import { ForbiddenField } from '../../common/forbidden-field.decorator';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class DecisionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ enum: ['Confirm', 'Deny'] })
  @IsIn(['Confirm', 'Deny'])
  decision!: 'Confirm' | 'Deny';

  /** Автор голоса — только сессия: любое значение user_id отклоняется. */
  @ForbiddenField('user_id')
  user_id?: never;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  signature?: string;
}
