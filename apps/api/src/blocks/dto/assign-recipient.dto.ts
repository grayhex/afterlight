import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class AssignRecipientDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  recipient_id!: string;

  @ApiProperty({ description: 'DEK, упакованный в браузере владельца под подтверждённый ключ получателя: RSA-OAEP 3072, стандартный base64, ровно 384 байта' })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  dek_wrapped_for_recipient!: string;

  @ApiProperty({ description: 'Отпечаток SHA-256 (hex) ключа, под который упакован DEK. Принимается, только если равен подтверждённому владельцем отпечатку получателя' })
  @IsString()
  @Matches(/^[0-9a-fA-F\s:]{64,160}$/, { message: 'key_fingerprint must be a SHA-256 hex digest' })
  key_fingerprint!: string;
}
