import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { createKeyword } from '../../src/domain/keyword/Keyword.js';
import { ApiRedisKeyBuilder } from '../../src/infrastructure/cache/redis/keyword/ApiRedisKeyBuilder.js';
import { RedisKeywordLookupCache } from '../../src/infrastructure/cache/redis/keyword/RedisKeywordLookupCache.js';
import { RedisConnection } from '../../src/infrastructure/redis/RedisConnection.js';
import { RedisMetrics } from '../../src/infrastructure/redis/RedisMetrics.js';

const redisUrl = process.env.API_REDIS_TEST_URL;

void test('実Redisでcache hit・TTL・破損値破棄・shutdownを確認する', { skip: !redisUrl }, async () => {
    assert.ok(redisUrl);
    const metrics = new RedisMetrics();
    const connection = new RedisConnection({
        url: redisUrl,
        connectTimeoutMs: 500,
        commandTimeoutMs: 250,
        reconnectBaseDelayMs: 20,
        reconnectMaxDelayMs: 100,
        metrics,
        random: (): number => 0
    });
    const namespace = `integration-${String(process.pid)}-${String(Date.now())}`;
    const keyBuilder = new ApiRedisKeyBuilder(namespace);
    const cache = new RedisKeywordLookupCache(connection, keyBuilder, 80, metrics);
    const scope = { guildId: '12345678901234567', channelId: '22345678901234567' } as const;
    const keyword = createKeyword({ ...scope, trigger: '猫', responses: ['にゃー'] });
    connection.start();

    try {
        let connected = false;
        for (let attempt = 0; attempt < 20 && !connected; attempt++) {
            try {
                await cache.set(scope, [keyword]);
                connected = true;
            } catch {
                await delay(25);
            }
        }
        assert.equal(connected, true);
        assert.deepEqual(await cache.get(scope), [keyword]);

        await delay(100);
        assert.equal(await cache.get(scope), undefined);

        await connection.set(keyBuilder.keywordList(scope), '{"schemaVersion":99}', 1000);
        assert.equal(await cache.get(scope), undefined);
        assert.equal(await connection.get(keyBuilder.keywordList(scope)), null);
    } finally {
        await cache.invalidate(scope).catch((): void => undefined);
        await connection.close();
    }

    await assert.rejects(connection.get(keyBuilder.keywordList(scope)));
});
