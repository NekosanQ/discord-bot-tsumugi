import { DashboardValidationError } from '../../domain/dashboard/DashboardErrors.js';
import type { ManagedChannelSnapshot } from '../../domain/dashboard/DashboardTypes.js';
import type { DashboardProjectionRepository } from './DashboardPorts.js';

function assertSnowflake(value: string, field: string): void {
    if (!/^\d{17,20}$/.test(value)) throw new DashboardValidationError(`${field}はDiscord snowflake形式である必要があります。`);
}

export class DashboardSnapshotService {
    public constructor(private readonly projection: DashboardProjectionRepository) {}

    public async sync(guildId: string, installed: boolean, channels: readonly ManagedChannelSnapshot[], correlationId: string): Promise<void> {
        assertSnowflake(guildId, 'guildId');
        for (const channel of channels) {
            assertSnowflake(channel.id, 'channelId');
            if (!channel.name.trim() || channel.name.length > 100) throw new DashboardValidationError('channel名が不正です。');
        }
        await this.projection.syncGuild(guildId, installed, installed ? channels : [], correlationId);
    }
}
