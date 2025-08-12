import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartVerificationEventDto {
  @ApiProperty()
  @IsUUID()
  vault_id!: string;
}
