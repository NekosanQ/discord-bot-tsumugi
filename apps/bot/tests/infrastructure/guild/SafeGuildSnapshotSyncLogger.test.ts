import assert from 'node:assert/strict';
import test from 'node:test';

import { SafeGuildSnapshotSyncLogger } from '../../../src/infrastructure/guild/SafeGuildSnapshotSyncLogger.js';

void test('snapshot同期ログへDiscord IDとHTTP error本文を含めない', (): void => {
    const entries: { message: string; detail: unknown }[] = [];
    const logger = new SafeGuildSnapshotSyncLogger({
        warn: (message, detail): void => {
            entries.push({ message, detail });
        }
    });

    logger.failure('channel-delete', new Error('guild 123456789012345678 bearer-token-detail'));

    assert.deepEqual(entries, [
        {
            message: 'Dashboard guild snapshot同期に失敗しました (channelDelete)',
            detail: 'Error'
        }
    ]);
    const serialized = JSON.stringify(entries);
    assert.equal(serialized.includes('123456789012345678'), false);
    assert.equal(serialized.includes('bearer-token-detail'), false);
});
