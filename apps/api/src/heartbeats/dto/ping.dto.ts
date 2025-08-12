import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class HeartbeatPingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ required: false, enum: ['auto', 'manual'] })
  @IsOptional()
  @IsIn(['auto', 'manual'])
  method?: 'auto' | 'manual';
}
