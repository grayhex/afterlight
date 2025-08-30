import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class CreateRecoveryShareDto {
  @ApiProperty()
  @IsString()
  vaultId: string;

  @ApiProperty()
  @IsInt()
  shareIndex: number;

  @ApiProperty()
  @IsString()
  shareCipher: string;
}
