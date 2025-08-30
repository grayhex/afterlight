import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;

  @ApiProperty({ required: false, enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
