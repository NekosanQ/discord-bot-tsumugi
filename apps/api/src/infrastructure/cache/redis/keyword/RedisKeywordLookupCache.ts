import type { KeywordLookupCache } from '../../../../application/keyword/KeywordLookupCache.js';
import type { KeywordScope } from '../../../../application/keyword/KeywordRepository.js';
import type { Keyword } from '../../../../domain/keyword/Keyword.js';
import { RedisMetrics, type RedisMetricsSnapshot } from '../../../redis/RedisMetrics.js';
import { ApiRedisKeyBuilder } from './ApiRedisKeyBuilder.js';
import { decodeKeywordCache, encodeKeywordCache } from './keywordCacheCodec.js';

function readInfoNumber(value: string, key: string): number | undefined {
    const line = value.split('\n').find((entry) => entry.startsWith(`${key}:`));
    if (!line) return undefined;
    const parsed = Number(line.slice(key.length + 1).trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export interface RedisCacheConnection {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttlMs: number) => Promise<string | null>;
    delete: (key: string) => Promise<number>;
    info: (section: 'memory' | 'stats') => Promise<string>;
}

export class RedisKeywordLookupCache implements KeywordLookupCache {
    public constructor(
        private readonly connection: RedisCacheConnection,
        private readonly keyBuilder: ApiRedisKeyBuilder,
        private readonly ttlMs: number,
        private readonly metrics: RedisMetrics
    ) {}

    public async get(scope: KeywordScope): Promise<readonly Keyword[] | undefined> {
        const key = this.keyBuilder.keywordList(scope);
        const value = await this.connection.get(key);
        if (value === null) {
            this.metrics.recordMiss();
            return undefined;
        }

        try {
            const keywords = decodeKeywordCache(value, scope);
            this.metrics.recordHit();
            return keywords;
        } catch {
            this.metrics.recordInvalidValue();
            await this.connection.delete(key).catch((): void => {
                this.metrics.markDegraded();
            });
            this.metrics.recordMiss();
            return undefined;
        }
    }

    public async set(scope: KeywordScope, keywords: readonly Keyword[]): Promise<void> {
        await this.connection.set(this.keyBuilder.keywordList(scope), encodeKeywordCache(keywords), this.ttlMs);
    }

    public async invalidate(scope: KeywordScope): Promise<void> {
        await this.connection.delete(this.keyBuilder.keywordList(scope));
    }

    public async diagnostics(): Promise<RedisMetricsSnapshot> {
        try {
            const [memory, stats] = await Promise.all([this.connection.info('memory'), this.connection.info('stats')]);
            this.metrics.markReady();
            return this.metrics.snapshot({
                usedMemoryBytes: readInfoNumber(memory, 'used_memory'),
                evictedKeys: readInfoNumber(stats, 'evicted_keys')
            });
        } catch {
            this.metrics.markDegraded();
            return this.metrics.snapshot();
        }
    }
}
