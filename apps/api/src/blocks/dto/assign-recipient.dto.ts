import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AssignRecipientDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  recipient_id!: string;

  @ApiProperty({ description: 'DEK wrapped for this recipient (base64 or JWE compact)' })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  dek_wrapped_for_recipient!: string;
}
