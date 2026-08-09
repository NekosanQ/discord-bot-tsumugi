import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createKeyword } from '../../../../../src/domain/keyword/Keyword.js';
import { ApiRedisKeyBuilder } from '../../../../../src/infrastructure/cache/redis/keyword/ApiRedisKeyBuilder.js';
import { type RedisCacheConnection, RedisKeywordLookupCache } from '../../../../../src/infrastructure/cache/redis/keyword/RedisKeywordLookupCache.js';
import { RedisMetrics } from '../../../../../src/infrastructure/redis/RedisMetrics.js';

const scope = { guildId: '12345678901234567', channelId: '22345678901234567' } as const;

class FakeRedisConnection implements RedisCacheConnection {
    public value: string | null = null;
    public deletedKeys: string[] = [];
    public lastSet: { key: string; value: string; ttlMs: number } | undefined;

    public get(_key: string): Promise<string | null> {
        return Promise.resolve(this.value);
    }

    public set(key: string, value: string, ttlMs: number): Promise<string | null> {
        this.value = value;
        this.lastSet = { key, value, ttlMs };
        return Promise.resolve('OK');
    }

    public delete(key: string): Promise<number> {
        this.deletedKeys.push(key);
        this.value = null;
        return Promise.resolve(1);
    }

    public info(section: 'memory' | 'stats'): Promise<string> {
        return Promise.resolve(section === 'memory' ? '# Memory\r\nused_memory:1234\r\n' : '# Stats\r\nevicted_keys:5\r\n');
    }
}

void describe('RedisKeywordLookupCache', () => {
    void it('version付きnamespaceと有限TTLで値を保存して復元する', async () => {
        const connection = new FakeRedisConnection();
        const metrics = new RedisMetrics();
        const cache = new RedisKeywordLookupCache(connection, new ApiRedisKeyBuilder('test'), 5000, metrics);
        const keyword = createKeyword({ ...scope, trigger: '猫', responses: ['にゃー'] });

        await cache.set(scope, [keyword]);

        assert.ok(connection.lastSet);
        assert.equal(connection.lastSet.key, 'tsumugi:api:v1:test:keyword-list:12345678901234567:22345678901234567');
        assert.equal(connection.lastSet.ttlMs, 5000);
        assert.deepEqual(await cache.get(scope), [keyword]);
        assert.equal(metrics.snapshot().hits, 1);
    });

    void it('破損値を削除してcache missとして扱う', async () => {
        const connection = new FakeRedisConnection();
        connection.value = '{"schemaVersion":2,"keywords":[]}';
        const metrics = new RedisMetrics();
        const cache = new RedisKeywordLookupCache(connection, new ApiRedisKeyBuilder('test'), 5000, metrics);

        assert.equal(await cache.get(scope), undefined);
        assert.equal(connection.deletedKeys.length, 1);
        assert.equal(metrics.snapshot().invalidValues, 1);
        assert.equal(metrics.snapshot().misses, 1);
    });

    void it('memoryとevictionをIDなしの診断値へ変換する', async () => {
        const cache = new RedisKeywordLookupCache(new FakeRedisConnection(), new ApiRedisKeyBuilder('test'), 5000, new RedisMetrics());

        const diagnostics = await cache.diagnostics();

        assert.equal(diagnostics.state, 'ready');
        assert.equal(diagnostics.usedMemoryBytes, 1234);
        assert.equal(diagnostics.evictedKeys, 5);
    });
});
