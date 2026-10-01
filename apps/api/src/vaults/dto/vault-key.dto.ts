import { ApiProperty } from '@nestjs/swagger';

export class VaultKeyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Ключ сейфа под ключом из recovery-кода владельца: конверт v1, как его прислал браузер' })
  mk_wrapped!: string;
}
