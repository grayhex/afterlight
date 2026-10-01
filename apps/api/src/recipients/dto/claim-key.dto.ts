import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ClaimKeyDto {
  @ApiProperty({ description: 'Публичный ключ получателя: RSA-OAEP 3072, открытая экспонента 65537, SPKI в стандартном base64 (так его экспортирует браузер); пара создаётся в браузере получателя, приватная часть на сервер не передаётся' })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  pubkey!: string;
}

export class ClaimKeyResultDto {
  @ApiProperty({ description: 'SHA-256 (hex) ключа: его получатель сообщает владельцу вне сервера' })
  key_fingerprint!: string;

  @ApiProperty({ description: 'Сколько назначений на этот адрес получили ключ (сейфов, где вас назначили получателем)' })
  recipients!: number;
}
