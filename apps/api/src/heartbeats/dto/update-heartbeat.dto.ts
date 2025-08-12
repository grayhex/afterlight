import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateHeartbeatDto {
  @ApiProperty({ required: false, enum: ['auto', 'manual'] })
  @IsOptional()
  @IsIn(['auto', 'manual'])
  method?: 'auto' | 'manual';

  @ApiProperty({ required: false, description: 'Таймаут неактивности в днях' })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeout_days?: number;
}
