import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'toml';

export interface ApiConfig {
    host: string;
    port: number;
    requestBodyLimitBytes: number;
    requestTimeoutMs: number;
    shutdownTimeoutMs: number;
    keywordCache: {
        ttlMs: number;
        maxMemoryEntries: number;
        connectTimeoutMs: number;
        commandTimeoutMs: number;
        reconnectBaseDelayMs: number;
        reconnectMaxDelayMs: number;
    };
    dashboard: {
        origin: string;
        discordRequestTimeoutMs: number;
        oauthStateTtlMs: number;
        sessionIdleTtlMs: number;
        sessionAbsoluteTtlMs: number;
        tokenRefreshSkewMs: number;
        rateLimitWindowMs: number;
        authStartLimit: number;
        authCallbackLimit: number;
        mutationLimit: number;
        securityRedisConnectTimeoutMs: number;
        securityRedisCommandTimeoutMs: number;
        securityRedisReconnectBaseDelayMs: number;
        securityRedisReconnectMaxDelayMs: number;
    };
}

export interface DashboardEnvironment {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    sessionEncryptionKey: string;
    sessionSecret: string;
    securityRedisUrl?: string;
}

function readNumber(record: Record<string, unknown>, key: string, minimum: number): number {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
        throw new TypeError(`${key}は${String(minimum)}以上の整数である必要があります。`);
    }
    return value;
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = record[key];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${key}はtableである必要があります。`);
    return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${key}は空でない文字列である必要があります。`);
    return value;
}

export function loadApiConfig(baseDirectory = process.cwd(), environment = process.env.NODE_ENV ?? 'development'): ApiConfig {
    const configPath = path.resolve(baseDirectory, 'config', `${environment}.toml`);
    const selectedPath = existsSync(configPath) ? configPath : path.resolve(baseDirectory, 'config', 'example.toml');
    const value: unknown = parse(readFileSync(selectedPath, 'utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('API configのrootはtableである必要があります。');
    const record = value as Record<string, unknown>;
    const keywordCache = readRecord(record, 'keywordCache');
    const dashboard = readRecord(record, 'dashboard');
    const origin = readString(dashboard, 'origin');
    const parsedOrigin = new URL(origin);
    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
        throw new TypeError('dashboard.originはpathを含まないHTTP(S) originである必要があります。');
    }

    return {
        host: readString(record, 'host'),
        port: readNumber(record, 'port', 1),
        requestBodyLimitBytes: readNumber(record, 'requestBodyLimitBytes', 1024),
        requestTimeoutMs: readNumber(record, 'requestTimeoutMs', 1),
        shutdownTimeoutMs: readNumber(record, 'shutdownTimeoutMs', 1),
        keywordCache: {
            ttlMs: readNumber(keywordCache, 'ttlMs', 1),
            maxMemoryEntries: readNumber(keywordCache, 'maxMemoryEntries', 1),
            connectTimeoutMs: readNumber(keywordCache, 'connectTimeoutMs', 1),
            commandTimeoutMs: readNumber(keywordCache, 'commandTimeoutMs', 1),
            reconnectBaseDelayMs: readNumber(keywordCache, 'reconnectBaseDelayMs', 1),
            reconnectMaxDelayMs: readNumber(keywordCache, 'reconnectMaxDelayMs', 1)
        },
        dashboard: {
            origin,
            discordRequestTimeoutMs: readNumber(dashboard, 'discordRequestTimeoutMs', 1),
            oauthStateTtlMs: readNumber(dashboard, 'oauthStateTtlMs', 1),
            sessionIdleTtlMs: readNumber(dashboard, 'sessionIdleTtlMs', 1),
            sessionAbsoluteTtlMs: readNumber(dashboard, 'sessionAbsoluteTtlMs', 1),
            tokenRefreshSkewMs: readNumber(dashboard, 'tokenRefreshSkewMs', 0),
            rateLimitWindowMs: readNumber(dashboard, 'rateLimitWindowMs', 1),
            authStartLimit: readNumber(dashboard, 'authStartLimit', 1),
            authCallbackLimit: readNumber(dashboard, 'authCallbackLimit', 1),
            mutationLimit: readNumber(dashboard, 'mutationLimit', 1),
            securityRedisConnectTimeoutMs: readNumber(dashboard, 'securityRedisConnectTimeoutMs', 1),
            securityRedisCommandTimeoutMs: readNumber(dashboard, 'securityRedisCommandTimeoutMs', 1),
            securityRedisReconnectBaseDelayMs: readNumber(dashboard, 'securityRedisReconnectBaseDelayMs', 1),
            securityRedisReconnectMaxDelayMs: readNumber(dashboard, 'securityRedisReconnectMaxDelayMs', 1)
        }
    };
}

export function loadDashboardEnvironment(environment: NodeJS.ProcessEnv = process.env): DashboardEnvironment {
    const required = (key: string): string => {
        const value = environment[key];
        if (!value) throw new TypeError(`${key}を設定してください。`);
        return value;
    };
    const redirectUri = required('API_DISCORD_REDIRECT_URI');
    const parsedRedirect = new URL(redirectUri);
    if (!['http:', 'https:'].includes(parsedRedirect.protocol)) throw new TypeError('API_DISCORD_REDIRECT_URIはHTTP(S) URLである必要があります。');
    return {
        clientId: required('API_DISCORD_CLIENT_ID'),
        clientSecret: required('API_DISCORD_CLIENT_SECRET'),
        redirectUri,
        sessionEncryptionKey: required('API_SESSION_ENCRYPTION_KEY'),
        sessionSecret: required('API_SESSION_SECRET'),
        securityRedisUrl: environment.API_SECURITY_REDIS_URL
    };
}
