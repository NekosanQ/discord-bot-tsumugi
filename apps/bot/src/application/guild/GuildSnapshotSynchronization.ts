export type ManagedGuildChannelType = 'text' | 'announcement';

export interface ManagedGuildChannelSnapshot {
    readonly id: string;
    readonly name: string;
    readonly type: ManagedGuildChannelType;
}

export interface GuildSnapshot {
    readonly guildId: string;
    readonly installed: boolean;
    readonly channels: readonly ManagedGuildChannelSnapshot[];
}

/** Dashboard projectionへBotが観測したguildの完全snapshotを送るport。 */
export interface GuildSnapshotSynchronization {
    sync: (snapshot: GuildSnapshot) => Promise<void>;
}
