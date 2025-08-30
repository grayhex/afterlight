import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecoverySharesService } from './recovery-shares.service';
import { CreateRecoveryShareDto } from './dto/create-recovery-share.dto';
import { UpdateRecoveryShareDto } from './dto/update-recovery-share.dto';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

@ApiTags('recovery-shares')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('recovery-shares')
export class RecoverySharesController {
  constructor(private readonly service: RecoverySharesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateRecoveryShareDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecoveryShareDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
