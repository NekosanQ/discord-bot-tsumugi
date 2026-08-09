import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { BotRedisKeyBuilder } from '../../src/infrastructure/cooldown/redis/BotRedisKeyBuilder.js';
import { RedisCooldownStore } from '../../src/infrastructure/cooldown/redis/RedisCooldownStore.js';
import { RedisConnection } from '../../src/infrastructure/redis/RedisConnection.js';
import { RedisMetrics } from '../../src/infrastructure/redis/RedisMetrics.js';

const redisUrl = process.env.BOT_REDIS_TEST_URL;

void test('実Redisで複数process相当のcooldown取得を1件だけ成功させる', { skip: !redisUrl }, async () => {
    assert.ok(redisUrl);
    const createConnection = (): RedisConnection => {
        const connection = new RedisConnection({
            url: redisUrl,
            connectTimeoutMs: 500,
            commandTimeoutMs: 250,
            reconnectBaseDelayMs: 20,
            reconnectMaxDelayMs: 100,
            metrics: new RedisMetrics(),
            random: (): number => 0
        });
        connection.start();
        return connection;
    };
    const firstConnection = createConnection();
    const secondConnection = createConnection();
    const keyBuilder = new BotRedisKeyBuilder(`integration-${String(process.pid)}-${String(Date.now())}`);
    const firstStore = new RedisCooldownStore(firstConnection, keyBuilder);
    const secondStore = new RedisCooldownStore(secondConnection, keyBuilder);
    const key = { commandKey: 'ping', userId: '12345678901234567' };

    try {
        let connected = false;
        for (let attempt = 0; attempt < 20 && !connected; attempt++) {
            try {
                await firstConnection.delete(keyBuilder.cooldown(key));
                connected = true;
            } catch {
                await delay(25);
            }
        }
        assert.equal(connected, true);

        const decisions = await Promise.all([firstStore.acquire(key, 1000), secondStore.acquire(key, 1000)]);
        assert.equal(decisions.filter((decision) => decision.acquired).length, 1);
        assert.equal(decisions.filter((decision) => !decision.acquired).length, 1);
    } finally {
        await firstConnection.delete(keyBuilder.cooldown(key)).catch((): void => undefined);
        await Promise.all([firstConnection.close(), secondConnection.close()]);
    }

    await assert.rejects(firstStore.acquire(key, 1000));
});
