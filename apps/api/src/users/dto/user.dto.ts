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

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  locale!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
