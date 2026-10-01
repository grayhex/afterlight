import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ description: 'Адрес подтверждён: до этого создание сейфа, приглашения и голосование закрыты' })
  email_verified!: boolean;
}

/** Ответ без данных: `{}`. Запрос принят; существует ли адрес или токен, из ответа не видно. */
export class EmptyResponseDto {}
