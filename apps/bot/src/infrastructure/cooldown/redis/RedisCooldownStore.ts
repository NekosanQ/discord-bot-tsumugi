import type { CooldownDecision, CooldownKey, CooldownStore } from '../../../application/cooldown/CooldownStore.js';
import { BotRedisKeyBuilder } from './BotRedisKeyBuilder.js';

export interface RedisCooldownConnection {
    setIfAbsent: (key: string, ttlMs: number) => Promise<string | null>;
    ttl: (key: string) => Promise<number>;
}

export class RedisCooldownStore implements CooldownStore {
    public constructor(
        private readonly connection: RedisCooldownConnection,
        private readonly keyBuilder: BotRedisKeyBuilder
    ) {}

    public async acquire(key: CooldownKey, ttlMs: number): Promise<CooldownDecision> {
        const redisKey = this.keyBuilder.cooldown(key);
        if ((await this.connection.setIfAbsent(redisKey, ttlMs)) === 'OK') return { acquired: true };

        const retryAfterMs = await this.connection.ttl(redisKey);
        if (retryAfterMs > 0) return { acquired: false, retryAfterMs };

        if ((await this.connection.setIfAbsent(redisKey, ttlMs)) === 'OK') return { acquired: true };
        const retriedTtl = await this.connection.ttl(redisKey);
        return { acquired: false, retryAfterMs: Math.max(retriedTtl, 1) };
    }
}
