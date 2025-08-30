import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

@ApiTags('users')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserDto, isArray: true })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: UserDto })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: UserDto })
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserDto })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: UserDto })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
