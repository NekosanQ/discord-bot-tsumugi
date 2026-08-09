import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BotRedisKeyBuilder } from '../../../../src/infrastructure/cooldown/redis/BotRedisKeyBuilder.js';
import { type RedisCooldownConnection, RedisCooldownStore } from '../../../../src/infrastructure/cooldown/redis/RedisCooldownStore.js';

class FakeRedisConnection implements RedisCooldownConnection {
    public setResults: (string | null)[] = [];
    public ttlResults: number[] = [];
    public keys: string[] = [];

    public setIfAbsent(key: string, _ttlMs: number): Promise<string | null> {
        this.keys.push(key);
        return Promise.resolve(this.setResults.shift() ?? null);
    }

    public ttl(_key: string): Promise<number> {
        return Promise.resolve(this.ttlResults.shift() ?? -2);
    }
}

void describe('RedisCooldownStore', () => {
    void it('SET NX PX成功時にleaseを取得する', async () => {
        const connection = new FakeRedisConnection();
        connection.setResults.push('OK');
        const store = new RedisCooldownStore(connection, new BotRedisKeyBuilder('test'));

        assert.deepEqual(await store.acquire({ commandKey: 'keyword add', userId: '12345678901234567' }, 5000), { acquired: true });
        assert.match(connection.keys[0] ?? '', /^tsumugi:bot:v1:test:cooldown:[A-Za-z0-9_-]+:12345678901234567$/);
    });

    void it('既存keyのPTTLをretry時間として返す', async () => {
        const connection = new FakeRedisConnection();
        connection.setResults.push(null);
        connection.ttlResults.push(3210);
        const store = new RedisCooldownStore(connection, new BotRedisKeyBuilder('test'));

        assert.deepEqual(await store.acquire({ commandKey: 'ping', userId: '12345678901234567' }, 5000), {
            acquired: false,
            retryAfterMs: 3210
        });
    });

    void it('SET後に期限切れした競合では一度だけ再取得する', async () => {
        const connection = new FakeRedisConnection();
        connection.setResults.push(null, 'OK');
        connection.ttlResults.push(-2);
        const store = new RedisCooldownStore(connection, new BotRedisKeyBuilder('test'));

        assert.deepEqual(await store.acquire({ commandKey: 'ping', userId: '12345678901234567' }, 5000), { acquired: true });
        assert.equal(connection.keys.length, 2);
    });
});
