import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { RedisConnection } from '../../src/infrastructure/redis/RedisConnection.js';
import { RedisMetrics } from '../../src/infrastructure/redis/RedisMetrics.js';
import { AesGcmSecretCodec } from '../../src/infrastructure/security/AesGcmSecretCodec.js';
import { RedisDashboardRateLimiter } from '../../src/infrastructure/security/RedisDashboardRateLimiter.js';

const redisUrl = process.env.API_REDIS_TEST_URL;

function createConnection(url: string): RedisConnection {
    return new RedisConnection({
        url,
        connectTimeoutMs: 500,
        commandTimeoutMs: 250,
        reconnectBaseDelayMs: 20,
        reconnectMaxDelayMs: 100,
        metrics: new RedisMetrics(),
        random: (): number => 0
    });
}

async function waitUntilReady(connection: RedisConnection, probeKey: string): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt++) {
        try {
            await connection.set(probeKey, '1', 1000);
            return;
        } catch {
            await delay(25);
        }
    }
    assert.fail('Redisへ接続できませんでした。');
}

void test('実Redisでdashboard rate limitを複数接続間に原子的に共有する', { skip: !redisUrl }, async (): Promise<void> => {
    assert.ok(redisUrl);
    const firstConnection = createConnection(redisUrl);
    const secondConnection = createConnection(redisUrl);
    const environment = `integration-${String(process.pid)}-${String(Date.now())}`;
    const identifier = 'session:guild';
    const codec = new AesGcmSecretCodec(Buffer.alloc(32, 1).toString('base64'), Buffer.alloc(32, 2).toString('base64'));
    const policy = { windowMs: 1000, limits: { oauthStart: 1, oauthCallback: 1, mutation: 1 } } as const;
    const firstLimiter = new RedisDashboardRateLimiter(firstConnection, codec, environment, policy);
    const secondLimiter = new RedisDashboardRateLimiter(secondConnection, codec, environment, policy);
    const rateKey = `tsumugi:api-security:v1:${environment}:rate-limit:mutation:${codec.digest(identifier)}`;
    const firstProbe = `${rateKey}:probe:first`;
    const secondProbe = `${rateKey}:probe:second`;
    firstConnection.start();
    secondConnection.start();

    try {
        await Promise.all([waitUntilReady(firstConnection, firstProbe), waitUntilReady(secondConnection, secondProbe)]);
        const results = await Promise.all([firstLimiter.consume('mutation', identifier), secondLimiter.consume('mutation', identifier)]);
        assert.deepEqual([...results].sort(), [false, true]);
    } finally {
        await firstConnection.delete(rateKey).catch((): void => undefined);
        await firstConnection.delete(firstProbe).catch((): void => undefined);
        await firstConnection.delete(secondProbe).catch((): void => undefined);
        await Promise.all([firstConnection.close(), secondConnection.close()]);
    }

    await assert.rejects(firstLimiter.consume('mutation', identifier));
});
