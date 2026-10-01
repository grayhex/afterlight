import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { KEY_ENVELOPE_PATTERN } from '../../common/envelope.js';

export class SetVaultKeyDto {
  @ApiProperty({ description: 'Ключ сейфа (MK), упакованный в браузере владельца ключом из recovery-кода: конверт v1 (`v1.<iv>.<ct>`, base64url, ровно 84 символа). Задаётся один раз' })
  @IsString()
  @Matches(KEY_ENVELOPE_PATTERN, { message: 'mk_wrapped must be a v1 envelope of a 256-bit key' })
  mk_wrapped!: string;
}
