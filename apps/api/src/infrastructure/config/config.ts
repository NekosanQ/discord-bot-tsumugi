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

export function loadApiConfig(baseDirectory = process.cwd(), environment = process.env.NODE_ENV ?? 'development'): ApiConfig {
    const configPath = path.resolve(baseDirectory, 'config', `${environment}.toml`);
    const selectedPath = existsSync(configPath) ? configPath : path.resolve(baseDirectory, 'config', 'example.toml');
    const value: unknown = parse(readFileSync(selectedPath, 'utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('API configのrootはtableである必要があります。');
    const record = value as Record<string, unknown>;
    const keywordCache = readRecord(record, 'keywordCache');
    if (typeof record.host !== 'string' || record.host.trim() === '') throw new TypeError('hostは空でない文字列である必要があります。');

    return {
        host: record.host,
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
        }
    };
}
