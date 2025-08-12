import { Module } from '@nestjs/common';
import { VerifiersService } from './verifiers.service';
import { VerifiersController } from './verifiers.controller';

@Module({
  controllers: [VerifiersController],
  providers: [VerifiersService],
  exports: [VerifiersService],
})
export class VerifiersModule {}
