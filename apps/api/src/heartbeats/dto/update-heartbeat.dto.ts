import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateHeartbeatDto {
  @ApiProperty({ required: false, enum: ['auto', 'manual'] })
  @IsOptional()
  @IsIn(['auto', 'manual'])
  method?: 'auto' | 'manual';

  @ApiProperty({ required: false, description: 'Порог неактивности владельца в днях, после которого верификатор может начать процесс (0 — без порога); общая настройка сейфа' })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeout_days?: number;
}
