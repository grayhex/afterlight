import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ConfirmKeyDto {
  @ApiProperty({ description: 'Отпечаток SHA-256 (hex, пробелы и двоеточия допускаются), который владелец сверил с получателем вне сервера' })
  @IsString()
  @Matches(/^[0-9a-fA-F\s:]{64,160}$/, { message: 'key_fingerprint must be a SHA-256 hex digest' })
  key_fingerprint!: string;
}
