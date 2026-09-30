import { ApiProperty } from '@nestjs/swagger';
import { ForbiddenField } from '../../common/forbidden-field.decorator.js';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Решение задаётся самим маршрутом (confirm/deny). */
export class VerificationDecisionDto {
  /** Автор голоса — только сессия: любое значение user_id отклоняется. */
  @ForbiddenField('user_id')
  user_id?: never;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  signature?: string;
}
