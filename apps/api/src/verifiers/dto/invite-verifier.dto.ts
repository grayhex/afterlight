import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class InviteVerifierDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ description: 'Email приглашаемого верификатора' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ required: false, default: 168, description: 'Срок действия в часах (по умолчанию 7 суток, максимум 30)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  expires_in_hours?: number;
}
