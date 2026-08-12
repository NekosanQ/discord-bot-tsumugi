import assert from 'node:assert/strict';
import test from 'node:test';

import type { GuildSnapshot, GuildSnapshotSynchronization } from '../../../src/application/guild/GuildSnapshotSynchronization.js';
import type { GuildSnapshotSyncLogger, GuildSnapshotSyncTrigger } from '../../../src/application/guild/GuildSnapshotSyncLogger.js';
import { SyncGuildSnapshot } from '../../../src/application/guild/SyncGuildSnapshot.js';

const snapshot: GuildSnapshot = {
    guildId: '123456789012345678',
    installed: true,
    channels: [{ id: '223456789012345678', name: 'general', type: 'text' }]
};

void test('同期成功時はframework非依存snapshotをportへそのまま渡す', async (): Promise<void> => {
    const received: GuildSnapshot[] = [];
    const synchronization: GuildSnapshotSynchronization = {
        sync: (value): Promise<void> => {
            received.push(value);
            return Promise.resolve();
        }
    };
    const logger: GuildSnapshotSyncLogger = { failure: (): void => assert.fail('logger should not be called') };

    await new SyncGuildSnapshot(synchronization, logger).execute(snapshot, 'guild-create');

    assert.deepEqual(received, [snapshot]);
});

void test('同期失敗はeventへ伝播させず明示loggerへ分類する', async (): Promise<void> => {
    const failure = new Error('sensitive-http-detail');
    const logged: { trigger: GuildSnapshotSyncTrigger; error: unknown }[] = [];
    const synchronization: GuildSnapshotSynchronization = {
        sync: (): Promise<void> => Promise.reject(failure)
    };
    const logger: GuildSnapshotSyncLogger = {
        failure: (trigger, error): void => {
            logged.push({ trigger, error });
        }
    };

    await new SyncGuildSnapshot(synchronization, logger).execute(snapshot, 'channel-update');

    assert.deepEqual(logged, [{ trigger: 'channel-update', error: failure }]);
});
