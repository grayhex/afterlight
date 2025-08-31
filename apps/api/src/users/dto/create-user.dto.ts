import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  passwordHash?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  passkeyPub?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  twoFaEnabled?: boolean;

  @ApiProperty({ required: false, enum: UserRole, default: UserRole.Owner })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ required: false, default: 'ru-RU' })
  @IsOptional()
  @IsString()
  locale?: string;
}
