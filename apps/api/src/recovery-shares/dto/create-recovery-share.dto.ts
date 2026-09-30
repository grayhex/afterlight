import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRecoveryShareDto {
  @ApiProperty()
  @IsUUID()
  vaultId!: string;

  @ApiProperty()
  @IsInt()
  shareIndex!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(16384)
  shareCipher!: string;
}
