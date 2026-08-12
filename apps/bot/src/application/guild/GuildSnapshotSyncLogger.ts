export type GuildSnapshotSyncTrigger = 'client-ready' | 'guild-create' | 'guild-delete' | 'channel-create' | 'channel-delete' | 'channel-update';

export interface GuildSnapshotSyncLogger {
    failure: (trigger: GuildSnapshotSyncTrigger, error: unknown) => void;
}
