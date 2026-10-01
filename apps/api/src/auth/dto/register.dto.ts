import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  /** Токен приглашения из письма: если он выписан на этот же адрес, владение почтой уже доказано, и адрес считается подтверждённым */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  invitation_token?: string;
}
