import { Module } from '@nestjs/common';
import { VerifiersController } from './verifiers.controller';
import { VerifiersService } from './verifiers.service';

@Module({
  controllers: [VerifiersController],
  providers: [VerifiersService],
})
export class VerifiersModule {}