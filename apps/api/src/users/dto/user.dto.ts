import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty()
  twoFaEnabled!: boolean;

  @ApiProperty({ nullable: true, type: Date, description: 'Когда подтверждён адрес; null — не подтверждён' })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  locale!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
