import type { GuildSnapshot, GuildSnapshotSynchronization } from './GuildSnapshotSynchronization.js';
import type { GuildSnapshotSyncLogger, GuildSnapshotSyncTrigger } from './GuildSnapshotSyncLogger.js';

export interface GuildSnapshotSyncUseCase {
    execute: (snapshot: GuildSnapshot, trigger: GuildSnapshotSyncTrigger) => Promise<void>;
}

/** HTTP障害をDiscord eventへ伝播させず、安全なloggerへ分類して記録する。 */
export class SyncGuildSnapshot implements GuildSnapshotSyncUseCase {
    public constructor(
        private readonly synchronization: GuildSnapshotSynchronization,
        private readonly logger: GuildSnapshotSyncLogger
    ) {}

    public async execute(snapshot: GuildSnapshot, trigger: GuildSnapshotSyncTrigger): Promise<void> {
        try {
            await this.synchronization.sync(snapshot);
        } catch (error) {
            this.logger.failure(trigger, error);
        }
    }
}
