import type { ManagedGuild } from '../../domain/guild/ManagedGuild.js';

export interface ManagedGuildRepository {
    saveInstallation: (guild: ManagedGuild) => Promise<void>;
}
