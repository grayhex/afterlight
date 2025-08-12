import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateBlockDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ enum: ['text', 'file', 'url'] })
  @IsIn(['text', 'file', 'url'])
  type!: 'text' | 'file' | 'url';

  @ApiProperty({ description: 'Wrapped DEK (base64 or JWE compact)' })
  @IsString()
  @MaxLength(8192)
  dek_wrapped!: string;

  @ApiProperty({ required: false, description: 'Arbitrary JSON metadata (stringified or object)' })
  @IsOptional()
  metadata?: any;

  @ApiProperty({ required: false, type: [String], default: [] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiProperty({ required: false, description: 'Encrypted payload size in bytes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  checksum?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_public?: boolean;
}
