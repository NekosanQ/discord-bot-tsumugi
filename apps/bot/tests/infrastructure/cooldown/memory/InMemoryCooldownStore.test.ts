import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InMemoryCooldownStore } from '../../../../src/infrastructure/cooldown/memory/InMemoryCooldownStore.js';

void describe('InMemoryCooldownStore', () => {
    void it('同じcommandとuserをTTL中は拒否し、期限後に再取得する', async () => {
        let now = 1000;
        const store = new InMemoryCooldownStore({ maxEntries: 10, now: (): number => now });
        const key = { commandKey: 'ping', userId: '12345678901234567' };

        assert.deepEqual(await store.acquire(key, 100), { acquired: true });
        assert.deepEqual(await store.acquire(key, 100), { acquired: false, retryAfterMs: 100 });

        now += 100;
        assert.deepEqual(await store.acquire(key, 100), { acquired: true });
    });

    void it('command単位でkeyを分離する', async () => {
        const store = new InMemoryCooldownStore({ maxEntries: 10 });
        const userId = '12345678901234567';

        assert.deepEqual(await store.acquire({ commandKey: 'ping', userId }, 100), { acquired: true });
        assert.deepEqual(await store.acquire({ commandKey: 'help', userId }, 100), { acquired: true });
    });
});
