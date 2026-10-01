import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { CIPHERTEXT_ENVELOPE_PATTERN, KEY_ENVELOPE_PATTERN, MAX_CIPHERTEXT_LENGTH } from '../../common/envelope.js';

export class CreateBlockDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vault_id!: string;

  // Файлы и ссылки — отдельный срез (хранилища файлов нет): путь выключен явно, а не работает через заглушку
  @ApiProperty({ enum: ['text'], description: 'Только текстовый блок; file и url не поддерживаются' })
  @IsIn(['text'])
  type!: 'text';

  @ApiProperty({ description: 'Ключ блока (DEK), упакованный ключом сейфа в браузере владельца: конверт v1 (`v1.<iv>.<ct>`, base64url, ровно 84 символа)' })
  @IsString()
  @Matches(KEY_ENVELOPE_PATTERN, { message: 'dek_wrapped must be a v1 envelope of a 256-bit key' })
  dek_wrapped!: string;

  @ApiProperty({ description: 'Шифротекст блока: конверт v1 (AES-256-GCM), собранный в браузере; сервер хранит его как непрозрачный текст', maxLength: MAX_CIPHERTEXT_LENGTH })
  @IsString()
  @MaxLength(MAX_CIPHERTEXT_LENGTH)
  @Matches(CIPHERTEXT_ENVELOPE_PATTERN, { message: 'ciphertext must be a v1 envelope' })
  ciphertext!: string;

  @ApiProperty({ required: false, description: 'Arbitrary JSON metadata (stringified or object)' })
  @IsOptional()
  metadata?: any;

  @ApiProperty({ required: false, type: [String], default: [] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  checksum?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_public?: boolean;
}
