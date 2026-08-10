import { createServer, type Server } from 'node:http';

import { PrismaClient } from '@prisma/client';

import { DashboardAuthService } from '../application/dashboard/DashboardAuthService.js';
import type { DashboardRateLimiter } from '../application/dashboard/DashboardPorts.js';
import { DashboardService } from '../application/dashboard/DashboardService.js';
import { DashboardSnapshotService } from '../application/dashboard/DashboardSnapshotService.js';
import { ManagedGuildService } from '../application/guild/ManagedGuildService.js';
import type { KeywordLookupCache } from '../application/keyword/KeywordLookupCache.js';
import { KeywordService } from '../application/keyword/KeywordService.js';
import { InMemoryKeywordLookupCache } from '../infrastructure/cache/memory/keyword/InMemoryKeywordLookupCache.js';
import { ApiRedisKeyBuilder } from '../infrastructure/cache/redis/keyword/ApiRedisKeyBuilder.js';
import { RedisKeywordLookupCache } from '../infrastructure/cache/redis/keyword/RedisKeywordLookupCache.js';
import { loadApiConfig, loadDashboardEnvironment } from '../infrastructure/config/config.js';
import { FetchDiscordOAuthGateway } from '../infrastructure/discord/FetchDiscordOAuthGateway.js';
import { PrismaDashboardAuthRepository } from '../infrastructure/persistence/prisma/dashboard/PrismaDashboardAuthRepository.js';
import { PrismaDashboardKeywordRepository } from '../infrastructure/persistence/prisma/dashboard/PrismaDashboardKeywordRepository.js';
import { PrismaDashboardProjectionRepository } from '../infrastructure/persistence/prisma/dashboard/PrismaDashboardProjectionRepository.js';
import { PrismaManagedGuildRepository } from '../infrastructure/persistence/prisma/guild/PrismaManagedGuildRepository.js';
import { PrismaKeywordRepository } from '../infrastructure/persistence/prisma/keyword/PrismaKeywordRepository.js';
import { RedisCommandTimeoutError, RedisConnection } from '../infrastructure/redis/RedisConnection.js';
import { RedisMetrics, type RedisMetricsSnapshot } from '../infrastructure/redis/RedisMetrics.js';
import { AesGcmSecretCodec } from '../infrastructure/security/AesGcmSecretCodec.js';
import { type DashboardRateLimitPolicy, InMemoryDashboardRateLimiter } from '../infrastructure/security/InMemoryDashboardRateLimiter.js';
import { RedisDashboardRateLimiter } from '../infrastructure/security/RedisDashboardRateLimiter.js';
import { createDashboardHttpHandler } from '../interface-adapter/http/dashboard/createDashboardHttpHandler.js';
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

function formatRedisMetrics(snapshot: RedisMetricsSnapshot, securitySnapshot: RedisMetricsSnapshot, securityUsesMemory: boolean): string {
    const ready = snapshot.state === 'ready' ? 1 : 0;
    const lines = [
        `tsumugi_api_redis_up ${String(ready)}`,
        `tsumugi_api_keyword_cache_hits_total ${String(snapshot.hits)}`,
        `tsumugi_api_keyword_cache_misses_total ${String(snapshot.misses)}`,
        `tsumugi_api_keyword_cache_fallbacks_total ${String(snapshot.fallbacks)}`,
        `tsumugi_api_redis_timeouts_total ${String(snapshot.timeouts)}`,
        `tsumugi_api_keyword_cache_invalid_values_total ${String(snapshot.invalidValues)}`,
        `tsumugi_api_security_redis_up ${securitySnapshot.state === 'ready' ? '1' : '0'}`,
        `tsumugi_api_security_rate_limiter_in_memory ${securityUsesMemory ? '1' : '0'}`
    ];
    if (snapshot.usedMemoryBytes !== undefined) lines.push(`tsumugi_api_redis_used_memory_bytes ${String(snapshot.usedMemoryBytes)}`);
    if (snapshot.evictedKeys !== undefined) lines.push(`tsumugi_api_redis_evicted_keys_total ${String(snapshot.evictedKeys)}`);
    return `${lines.join('\n')}\n`;
}

export function createProductionApplication(serviceToken: string): ApiApplication {
    const config = loadApiConfig();
    const dashboardEnvironment = loadDashboardEnvironment();
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
    const secrets = new AesGcmSecretCodec(dashboardEnvironment.sessionEncryptionKey, dashboardEnvironment.sessionSecret);
    const discord = new FetchDiscordOAuthGateway({
        clientId: dashboardEnvironment.clientId,
        clientSecret: dashboardEnvironment.clientSecret,
        redirectUri: dashboardEnvironment.redirectUri,
        requestTimeoutMs: config.dashboard.discordRequestTimeoutMs
    });
    const authRepository = new PrismaDashboardAuthRepository(prisma);
    const projection = new PrismaDashboardProjectionRepository(prisma);
    const dashboardAuth = new DashboardAuthService(
        authRepository,
        discord,
        secrets,
        {
            oauthStateTtlMs: config.dashboard.oauthStateTtlMs,
            sessionIdleTtlMs: config.dashboard.sessionIdleTtlMs,
            sessionAbsoluteTtlMs: config.dashboard.sessionAbsoluteTtlMs,
            tokenRefreshSkewMs: config.dashboard.tokenRefreshSkewMs
        },
        {
            reportRevokeError: (): void => {
                process.stderr.write('Discord OAuth token revoke failed; the local session is already revoked.\n');
            }
        }
    );
    const dashboard = new DashboardService(dashboardAuth, discord, projection, new PrismaDashboardKeywordRepository(prisma));
    const snapshots = new DashboardSnapshotService(projection);
    const rateLimitPolicy: DashboardRateLimitPolicy = {
        windowMs: config.dashboard.rateLimitWindowMs,
        limits: {
            oauthStart: config.dashboard.authStartLimit,
            oauthCallback: config.dashboard.authCallbackLimit,
            mutation: config.dashboard.mutationLimit
        }
    };
    const securityRedisMetrics = new RedisMetrics((state): void => {
        if (state === 'degraded' || state === 'ready') process.stderr.write(`API security Redis state: ${state}\n`);
    });
    let securityRedisConnection: RedisConnection | undefined;
    let rateLimiter: DashboardRateLimiter;
    if (dashboardEnvironment.securityRedisUrl) {
        securityRedisConnection = new RedisConnection({
            url: dashboardEnvironment.securityRedisUrl,
            connectTimeoutMs: config.dashboard.securityRedisConnectTimeoutMs,
            commandTimeoutMs: config.dashboard.securityRedisCommandTimeoutMs,
            reconnectBaseDelayMs: config.dashboard.securityRedisReconnectBaseDelayMs,
            reconnectMaxDelayMs: config.dashboard.securityRedisReconnectMaxDelayMs,
            metrics: securityRedisMetrics
        });
        rateLimiter = new RedisDashboardRateLimiter(securityRedisConnection, secrets, process.env.NODE_ENV ?? 'development', rateLimitPolicy);
    } else {
        if (process.env.NODE_ENV === 'production') throw new TypeError('productionではAPI_SECURITY_REDIS_URLを設定してください。');
        rateLimiter = new InMemoryDashboardRateLimiter(rateLimitPolicy);
    }
    const keywordHandler = createKeywordHttpHandler(service, guildService, {
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
        requiredHealth: (): Promise<Record<string, 'ready' | 'unavailable' | 'in-memory'>> =>
            Promise.resolve({
                dashboardSecurity: securityRedisConnection
                    ? securityRedisMetrics.snapshot().state === 'ready'
                        ? 'ready'
                        : 'unavailable'
                    : 'in-memory'
            }),
        optionalHealth: async (): Promise<Record<string, unknown>> => {
            const snapshot = redisCache ? await redisCache.diagnostics() : redisMetrics.snapshot();
            return { keywordCache: snapshot.state };
        },
        metrics: async (): Promise<string> =>
            formatRedisMetrics(
                redisCache ? await redisCache.diagnostics() : redisMetrics.snapshot(),
                securityRedisMetrics.snapshot(),
                !securityRedisConnection
            ),
        reportError: (error: unknown): void => {
            const message = error instanceof Error ? error.message : 'unknown error';
            process.stderr.write(`API request error: ${message}\n`);
        }
    });
    const dashboardHandler = createDashboardHttpHandler({
        serviceToken,
        webProxyToken: dashboardEnvironment.webProxyToken,
        origin: config.dashboard.origin,
        secureCookies: process.env.NODE_ENV === 'production',
        requestBodyLimitBytes: config.requestBodyLimitBytes,
        oauthStateTtlMs: config.dashboard.oauthStateTtlMs,
        sessionAbsoluteTtlMs: config.dashboard.sessionAbsoluteTtlMs,
        auth: dashboardAuth,
        dashboard,
        snapshots,
        rateLimiter,
        reportError: (error: unknown): void => {
            const message = error instanceof Error ? error.message : 'unknown error';
            process.stderr.write(`Dashboard request error: ${message}\n`);
        }
    });
    const handler = (request: Parameters<typeof keywordHandler>[0], response: Parameters<typeof keywordHandler>[1]): Promise<void> => {
        const path = request.url ?? '';
        return path.startsWith('/v1/dashboard/') || path.startsWith('/v1/internal/')
            ? dashboardHandler(request, response)
            : keywordHandler(request, response);
    };
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
            securityRedisConnection?.start();
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
                await securityRedisConnection?.close();
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
