import assert from 'node:assert/strict';
import test from 'node:test';

import type { CooldownDecision, CooldownKey, CooldownStore } from '../../../src/application/cooldown/CooldownStore.js';
import { ResilientCooldownStore } from '../../../src/infrastructure/cooldown/ResilientCooldownStore.js';
import { RedisCommandTimeoutError } from '../../../src/infrastructure/redis/RedisConnection.js';
import { RedisMetrics } from '../../../src/infrastructure/redis/RedisMetrics.js';

class StaticCooldownStore implements CooldownStore {
    public constructor(
        private readonly decision: CooldownDecision,
        private readonly error?: Error
    ) {}

    public acquire(_key: CooldownKey, _ttlMs: number): Promise<CooldownDecision> {
        return this.error ? Promise.reject(this.error) : Promise.resolve(this.decision);
    }
}

void test('Redis timeout時にin-memoryへfallbackしてdegraded指標を記録する', async () => {
    const metrics = new RedisMetrics();
    const store = new ResilientCooldownStore(
        new StaticCooldownStore({ acquired: true }, new RedisCommandTimeoutError(50)),
        new StaticCooldownStore({ acquired: true }),
        metrics
    );

    assert.deepEqual(await store.acquire({ commandKey: 'ping', userId: '12345678901234567' }, 5000), { acquired: true });
    assert.deepEqual(metrics.snapshot(), { state: 'degraded', acquired: 1, rejected: 0, fallbacks: 1, timeouts: 1 });
});
