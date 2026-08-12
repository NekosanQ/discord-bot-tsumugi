import type { GuildSnapshotSyncLogger, GuildSnapshotSyncTrigger } from '../../application/guild/GuildSnapshotSyncLogger.js';

export interface GuildSnapshotWarningSink {
    warn: (message: string, detail?: unknown) => void;
}

function triggerName(trigger: GuildSnapshotSyncTrigger): string {
    switch (trigger) {
        case 'client-ready':
            return 'ready';
        case 'guild-create':
            return 'guildCreate';
        case 'guild-delete':
            return 'guildDelete';
        case 'channel-create':
            return 'channelCreate';
        case 'channel-delete':
            return 'channelDelete';
        case 'channel-update':
            return 'channelUpdate';
    }
}

/** Discord ID・channel名・HTTP error本文を記録せず、失敗箇所と種類だけを出力する。 */
export class SafeGuildSnapshotSyncLogger implements GuildSnapshotSyncLogger {
    public constructor(private readonly sink: GuildSnapshotWarningSink) {}

    public failure(trigger: GuildSnapshotSyncTrigger, error: unknown): void {
        const errorKind = error instanceof Error ? 'Error' : 'UnknownFailure';
        this.sink.warn(`Dashboard guild snapshot同期に失敗しました (${triggerName(trigger)})`, errorKind);
    }
}
