import { ApiProperty } from '@nestjs/swagger';
import { UserRole, VaultUserRoleStatus } from '@prisma/client';

/** Безопасное представление участника сейфа: только то, что нужно интерфейсу. */
export class VerifierMemberDto {
  @ApiProperty({ format: 'uuid', required: false, nullable: true, description: 'Пусто у приглашения, ещё не принятого аккаунтом' })
  user_id!: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true, description: 'Заполнено у ожидающего приглашения' })
  invitation_id!: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty({ required: false, nullable: true })
  name!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: VaultUserRoleStatus })
  status!: VaultUserRoleStatus;

  @ApiProperty()
  is_primary!: boolean;

  @ApiProperty({ required: false, nullable: true })
  expires_at!: Date | null;

  @ApiProperty()
  added_at!: Date;
}

export class InvitationCreatedDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  expires_at!: Date;
}
