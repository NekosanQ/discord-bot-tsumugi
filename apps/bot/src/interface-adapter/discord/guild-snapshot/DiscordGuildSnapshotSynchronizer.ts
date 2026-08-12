import { ChannelType, PermissionFlagsBits } from 'discord.js';

import type { ManagedGuildChannelSnapshot } from '../../../application/guild/GuildSnapshotSynchronization.js';
import type { GuildSnapshotSyncTrigger } from '../../../application/guild/GuildSnapshotSyncLogger.js';
import type { GuildSnapshotSyncUseCase } from '../../../application/guild/SyncGuildSnapshot.js';

export interface DiscordGuildChannelSource {
    readonly id: string;
    readonly name: string;
    readonly type: ChannelType;
    permissionsFor(member: DiscordGuildMemberSource): DiscordGuildChannelPermissionsSource | null;
}

export interface DiscordGuildMemberSource {
    readonly id: string;
}

export interface DiscordGuildChannelPermissionsSource {
    has(permissions: bigint[]): boolean;
}

export interface DiscordGuildSnapshotSource {
    readonly id: string;
    readonly members: {
        readonly me: DiscordGuildMemberSource | null;
    };
    readonly channels: {
        readonly cache: {
            values: () => IterableIterator<DiscordGuildChannelSource>;
        };
    };
}

export interface DiscordClientGuildSnapshotSource {
    readonly guilds: {
        readonly cache: {
            values: () => IterableIterator<DiscordGuildSnapshotSource>;
        };
    };
}

export interface GuildSnapshotEventSynchronizer {
    synchronizeClient: (client: DiscordClientGuildSnapshotSource) => Promise<void>;
    synchronizeGuild: (
        guild: DiscordGuildSnapshotSource,
        trigger: Exclude<GuildSnapshotSyncTrigger, 'client-ready' | 'guild-delete'>
    ) => Promise<void>;
    synchronizeDeletedGuild: (guildId: string) => Promise<void>;
}

function toManagedChannel(channel: DiscordGuildChannelSource, botMember: DiscordGuildMemberSource): ManagedGuildChannelSnapshot | undefined {
    const type = channel.type === ChannelType.GuildText ? 'text' : channel.type === ChannelType.GuildAnnouncement ? 'announcement' : undefined;
    if (!type) return undefined;
    const permissions = channel.permissionsFor(botMember);
    if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) return undefined;
    return { id: channel.id, name: channel.name, type };
}

/** Discord cacheをframework非依存な完全snapshotへ変換する。 */
export class DiscordGuildSnapshotSynchronizer implements GuildSnapshotEventSynchronizer {
    private readonly guildQueues = new Map<string, Promise<void>>();

    public constructor(private readonly syncSnapshot: GuildSnapshotSyncUseCase) {}

    public async synchronizeClient(client: DiscordClientGuildSnapshotSource): Promise<void> {
        await Promise.all([...client.guilds.cache.values()].map((guild): Promise<void> => this.syncInstalledGuild(guild, 'client-ready')));
    }

    public async synchronizeGuild(
        guild: DiscordGuildSnapshotSource,
        trigger: Exclude<GuildSnapshotSyncTrigger, 'client-ready' | 'guild-delete'>
    ): Promise<void> {
        await this.syncInstalledGuild(guild, trigger);
    }

    public async synchronizeDeletedGuild(guildId: string): Promise<void> {
        await this.enqueue(guildId, (): Promise<void> => this.syncSnapshot.execute({ guildId, installed: false, channels: [] }, 'guild-delete'));
    }

    private async syncInstalledGuild(guild: DiscordGuildSnapshotSource, trigger: Exclude<GuildSnapshotSyncTrigger, 'guild-delete'>): Promise<void> {
        const botMember = guild.members.me;
        const channels = botMember
            ? [...guild.channels.cache.values()].flatMap((channel): ManagedGuildChannelSnapshot[] => {
                  const managedChannel = toManagedChannel(channel, botMember);
                  return managedChannel ? [managedChannel] : [];
              })
            : [];
        await this.enqueue(guild.id, (): Promise<void> => this.syncSnapshot.execute({ guildId: guild.id, installed: true, channels }, trigger));
    }

    private async enqueue(guildId: string, operation: () => Promise<void>): Promise<void> {
        const previous = this.guildQueues.get(guildId) ?? Promise.resolve();
        const current = previous.then(operation, operation);
        this.guildQueues.set(guildId, current);
        try {
            await current;
        } finally {
            if (this.guildQueues.get(guildId) === current) this.guildQueues.delete(guildId);
        }
    }
}
