import type { CooldownDecision, CooldownKey, CooldownStore } from '../../application/cooldown/CooldownStore.js';
import { RedisCommandTimeoutError } from '../redis/RedisConnection.js';
import { RedisMetrics } from '../redis/RedisMetrics.js';

export class ResilientCooldownStore implements CooldownStore {
    public constructor(
        private readonly primary: CooldownStore,
        private readonly fallback: CooldownStore,
        private readonly metrics: RedisMetrics
    ) {}

    public async acquire(key: CooldownKey, ttlMs: number): Promise<CooldownDecision> {
        try {
            const decision = await this.primary.acquire(key, ttlMs);
            this.metrics.markReady();
            this.metrics.recordDecision(decision.acquired);
            return decision;
        } catch (error) {
            this.metrics.recordFallback(error instanceof RedisCommandTimeoutError);
            const decision = await this.fallback.acquire(key, ttlMs);
            this.metrics.recordDecision(decision.acquired);
            return decision;
        }
    }
}
