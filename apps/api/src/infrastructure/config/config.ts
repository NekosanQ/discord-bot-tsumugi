import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'toml';

export interface ApiConfig {
    host: string;
    port: number;
    requestBodyLimitBytes: number;
    requestTimeoutMs: number;
    shutdownTimeoutMs: number;
}

function readNumber(record: Record<string, unknown>, key: string, minimum: number): number {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
        throw new TypeError(`${key}は${String(minimum)}以上の整数である必要があります。`);
    }
    return value;
}

export function loadApiConfig(baseDirectory = process.cwd(), environment = process.env.NODE_ENV ?? 'development'): ApiConfig {
    const configPath = path.resolve(baseDirectory, 'config', `${environment}.toml`);
    const selectedPath = existsSync(configPath) ? configPath : path.resolve(baseDirectory, 'config', 'example.toml');
    const value: unknown = parse(readFileSync(selectedPath, 'utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('API configのrootはtableである必要があります。');
    const record = value as Record<string, unknown>;
    if (typeof record.host !== 'string' || record.host.trim() === '') throw new TypeError('hostは空でない文字列である必要があります。');

    return {
        host: record.host,
        port: readNumber(record, 'port', 1),
        requestBodyLimitBytes: readNumber(record, 'requestBodyLimitBytes', 1024),
        requestTimeoutMs: readNumber(record, 'requestTimeoutMs', 1),
        shutdownTimeoutMs: readNumber(record, 'shutdownTimeoutMs', 1)
    };
}
