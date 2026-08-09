import { createManagedGuild } from '../../domain/guild/ManagedGuild.js';
import type { ManagedGuildRepository } from './ManagedGuildRepository.js';

export class ManagedGuildService {
    public constructor(private readonly repository: ManagedGuildRepository) {}

    public async setInstallation(guildId: string, installed: boolean): Promise<void> {
        await this.repository.saveInstallation(createManagedGuild(guildId, installed));
    }
}
