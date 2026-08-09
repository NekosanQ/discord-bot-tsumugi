import { createServer, type Server } from 'node:http';

import { PrismaClient } from '@prisma/client';

import { ManagedGuildService } from '../application/guild/ManagedGuildService.js';
import type { KeywordLookupCache } from '../application/keyword/KeywordLookupCache.js';
import { KeywordService } from '../application/keyword/KeywordService.js';
import { InMemoryKeywordLookupCache } from '../infrastructure/cache/memory/keyword/InMemoryKeywordLookupCache.js';
import { ApiRedisKeyBuilder } from '../infrastructure/cache/redis/keyword/ApiRedisKeyBuilder.js';
import { RedisKeywordLookupCache } from '../infrastructure/cache/redis/keyword/RedisKeywordLookupCache.js';
import { loadApiConfig } from '../infrastructure/config/config.js';
import { PrismaManagedGuildRepository } from '../infrastructure/persistence/prisma/guild/PrismaManagedGuildRepository.js';
import { PrismaKeywordRepository } from '../infrastructure/persistence/prisma/keyword/PrismaKeywordRepository.js';
import { RedisCommandTimeoutError, RedisConnection } from '../infrastructure/redis/RedisConnection.js';
import { RedisMetrics, type RedisMetricsSnapshot } from '../infrastructure/redis/RedisMetrics.js';
import { createKeywordHttpHandler } from '../interface-adapter/http/keyword/createKeywordHttpHandler.js';

export interface ApiApplication {
    start: () => Promise<void>;
    stop: () => Promise<void>;
}

function listen(server: Server, port: number, host: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, (): void => {
            server.removeListener('error', reject);
            resolve();
        });
    });
}

function formatRedisMetrics(snapshot: RedisMetricsSnapshot): string {
    const ready = snapshot.state === 'ready' ? 1 : 0;
    const lines = [
        `tsumugi_api_redis_up ${String(ready)}`,
        `tsumugi_api_keyword_cache_hits_total ${String(snapshot.hits)}`,
        `tsumugi_api_keyword_cache_misses_total ${String(snapshot.misses)}`,
        `tsumugi_api_keyword_cache_fallbacks_total ${String(snapshot.fallbacks)}`,
        `tsumugi_api_redis_timeouts_total ${String(snapshot.timeouts)}`,
        `tsumugi_api_keyword_cache_invalid_values_total ${String(snapshot.invalidValues)}`
    ];
    if (snapshot.usedMemoryBytes !== undefined) lines.push(`tsumugi_api_redis_used_memory_bytes ${String(snapshot.usedMemoryBytes)}`);
    if (snapshot.evictedKeys !== undefined) lines.push(`tsumugi_api_redis_evicted_keys_total ${String(snapshot.evictedKeys)}`);
    return `${lines.join('\n')}\n`;
}

export function createProductionApplication(serviceToken: string): ApiApplication {
    const config = loadApiConfig();
    const prisma = new PrismaClient();
    const redisMetrics = new RedisMetrics((state): void => {
        if (state === 'degraded' || state === 'ready') process.stderr.write(`API Redis cache state: ${state}\n`);
    });
    const redisUrl = process.env.API_REDIS_URL;
    let redisConnection: RedisConnection | undefined;
    let redisCache: RedisKeywordLookupCache | undefined;
    let keywordCache: KeywordLookupCache;
    if (redisUrl) {
        redisConnection = new RedisConnection({
            url: redisUrl,
            connectTimeoutMs: config.keywordCache.connectTimeoutMs,
            commandTimeoutMs: config.keywordCache.commandTimeoutMs,
            reconnectBaseDelayMs: config.keywordCache.reconnectBaseDelayMs,
            reconnectMaxDelayMs: config.keywordCache.reconnectMaxDelayMs,
            metrics: redisMetrics
        });
        redisCache = new RedisKeywordLookupCache(
            redisConnection,
            new ApiRedisKeyBuilder(process.env.NODE_ENV ?? 'development'),
            config.keywordCache.ttlMs,
            redisMetrics
        );
        keywordCache = redisCache;
    } else {
        keywordCache = new InMemoryKeywordLookupCache({
            ttlMs: config.keywordCache.ttlMs,
            maxEntries: config.keywordCache.maxMemoryEntries
        });
    }
    const service = new KeywordService(new PrismaKeywordRepository(prisma), {
        cache: keywordCache,
        reportCacheError: (_operation, error): void => {
            redisMetrics.recordFallback(error instanceof RedisCommandTimeoutError);
        }
    });
    const guildService = new ManagedGuildService(new PrismaManagedGuildRepository(prisma));
    const handler = createKeywordHttpHandler(service, guildService, {
        serviceToken,
        requestBodyLimitBytes: config.requestBodyLimitBytes,
        readiness: async (): Promise<boolean> => {
            try {
                await prisma.$queryRaw`SELECT 1`;
                return true;
            } catch {
                return false;
            }
        },
        optionalHealth: async (): Promise<Record<string, unknown>> => {
            const snapshot = redisCache ? await redisCache.diagnostics() : redisMetrics.snapshot();
            return { keywordCache: snapshot.state };
        },
        metrics: async (): Promise<string> => formatRedisMetrics(redisCache ? await redisCache.diagnostics() : redisMetrics.snapshot()),
        reportError: (error: unknown): void => {
            const message = error instanceof Error ? error.message : 'unknown error';
            process.stderr.write(`API request error: ${message}\n`);
        }
    });
    const server = createServer((request, response): void => {
        request.setTimeout(config.requestTimeoutMs, (): void => {
            request.destroy(new Error('request timeout'));
        });
        void handler(request, response).catch((error: unknown): void => {
            const message = error instanceof Error ? error.message : 'unknown error';
            process.stderr.write(`API handler error: ${message}\n`);
            if (!response.headersSent) {
                response.statusCode = 500;
                response.setHeader('content-type', 'application/json; charset=utf-8');
                response.end(JSON.stringify({ error: { code: 'internal_error', message: '予期しないエラーが発生しました。' } }));
            } else {
                response.destroy();
            }
        });
    });
    let started = false;

    return {
        start: async (): Promise<void> => {
            if (started) return;
            redisConnection?.start();
            await listen(server, config.port, config.host);
            started = true;
        },
        stop: async (): Promise<void> => {
            const errors: unknown[] = [];
            const runCleanup = async (cleanup: () => void | Promise<void>): Promise<void> => {
                try {
                    await cleanup();
                } catch (error) {
                    errors.push(error);
                }
            };
            if (started) {
                await runCleanup(
                    () =>
                        new Promise<void>((resolve, reject) => {
                            const timeout = setTimeout((): void => {
                                server.closeAllConnections();
                                reject(new Error(`APIを${String(config.shutdownTimeoutMs)}ms以内に終了できませんでした。`));
                            }, config.shutdownTimeoutMs);
                            server.close((): void => {
                                clearTimeout(timeout);
                                resolve();
                            });
                        })
                );
                started = false;
            }
            await runCleanup(async (): Promise<void> => {
                await redisConnection?.close();
            });
            await runCleanup(async (): Promise<void> => {
                await prisma.$disconnect();
            });
            if (errors.length > 0) {
                throw new AggregateError(errors, 'APIの終了処理中にエラーが発生しました。');
            }
        }
    };
}
