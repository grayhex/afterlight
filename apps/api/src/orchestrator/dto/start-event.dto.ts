import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vault_id!: string;
}
