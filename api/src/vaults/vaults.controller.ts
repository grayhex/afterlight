import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { VaultsService, VaultDto } from './vaults.service';

interface CreateVaultRequest {
  ownerId: string;
  name: string;
  description?: string;
}

@Controller('vaults')
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Get()
  listVaults(): VaultDto[] {
    return this.vaultsService.findAll();
  }

  @Get(':id')
  getVault(@Param('id') id: string): VaultDto {
    const vault = this.vaultsService.findOne(id);
    if (!vault) {
      throw new NotFoundException(`Vault with id=${id} not found`);
    }
    return vault;
  }

  @Post()
  createVault(@Body() body: CreateVaultRequest): VaultDto {
    const { ownerId, name, description } = body;
    return this.vaultsService.create(ownerId, name, description);
  }
}