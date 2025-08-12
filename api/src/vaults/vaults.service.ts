import { Injectable } from '@nestjs/common';

export interface VaultDto {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  createdAt: Date;
}

@Injectable()
export class VaultsService {
  private readonly vaults = new Map<string, VaultDto>();

  /**
   * Returns all vaults. In a real implementation this would query a database and filter by owner.
   */
  findAll(): VaultDto[] {
    return Array.from(this.vaults.values());
  }

  /**
   * Retrieves a specific vault by id.
   * @param id Vault identifier
   */
  findOne(id: string): VaultDto | undefined {
    return this.vaults.get(id);
  }

  /**
   * Creates a new vault with the given attributes. In a real system you would persist to the DB and generate IDs.
   * @param ownerId ID of the user creating the vault
   * @param name Human-readable name for the vault
   * @param description Optional description
   */
  create(ownerId: string, name: string, description?: string): VaultDto {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const vault: VaultDto = {
      id,
      ownerId,
      name,
      description,
      createdAt: new Date(),
    };
    this.vaults.set(id, vault);
    return vault;
  }
}