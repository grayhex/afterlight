import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class InviteVerifierDto {
  @ApiProperty()
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ description: 'email for MVP' })
  @IsString()
  email!: string;

  @ApiProperty({ required: false, default: 168, description: 'expires in hours (default 7 days)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expires_in_hours?: number;
}
