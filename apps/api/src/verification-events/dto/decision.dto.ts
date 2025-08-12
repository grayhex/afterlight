import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class DecisionDto {
  @ApiProperty({ enum: ['Confirm', 'Deny'] })
  @IsIn(['Confirm', 'Deny'])
  decision!: 'Confirm' | 'Deny';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  signature?: string;
}
