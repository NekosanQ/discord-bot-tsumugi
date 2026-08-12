import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'toml';

import { readWebApiProxyToken } from '../security/clientIdentity.js';

export interface WebConfig {
    internalApiUrl: URL;
    apiProxyToken: string;
    apiTimeoutMs: number;
    requestBodyLimitBytes: number;
}

function readPositiveInteger(record: Record<string, unknown>, key: string): number {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        throw new TypeError(`${key}は1以上の整数である必要があります。`);
    }
    return value;
}

function parseInternalApiUrl(value: string | undefined): URL {
    if (!value) throw new TypeError('WEB_INTERNAL_API_URLを設定してください。');
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username !== '' || url.password !== '') {
        throw new TypeError('WEB_INTERNAL_API_URLはcredentialを含まないhttp(s) URLである必要があります。');
    }
    if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
        throw new TypeError('WEB_INTERNAL_API_URLにはpath、query、fragmentを含めないでください。');
    }
    return url;
}

export function loadWebConfig(baseDirectory = process.cwd(), environment = process.env.NODE_ENV): WebConfig {
    const configDirectory = path.resolve(baseDirectory, 'config');
    const environmentPath = path.join(configDirectory, `${environment}.toml`);
    const selectedPath = existsSync(environmentPath) ? environmentPath : path.join(configDirectory, 'example.toml');
    const parsed: unknown = parse(readFileSync(selectedPath, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new TypeError('Web configのrootはtableである必要があります。');
    const record = parsed as Record<string, unknown>;
    return {
        internalApiUrl: parseInternalApiUrl(process.env.WEB_INTERNAL_API_URL),
        apiProxyToken: readWebApiProxyToken(),
        apiTimeoutMs: readPositiveInteger(record, 'apiTimeoutMs'),
        requestBodyLimitBytes: readPositiveInteger(record, 'requestBodyLimitBytes')
    };
}
