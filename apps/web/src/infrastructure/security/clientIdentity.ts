import { createHmac, timingSafeEqual } from 'node:crypto';

const opaqueClientIdPattern = /^[a-f0-9]{64}$/;

export function readWebApiProxyToken(value = process.env.WEB_API_PROXY_TOKEN): string {
    if (!value || Buffer.byteLength(value, 'utf8') < 32) throw new TypeError('WEB_API_PROXY_TOKENは32byte以上で設定してください。');
    return value;
}

export function createOpaqueClientId(source: string, proxyToken: string): string {
    if (source.length === 0 || source.length > 512) throw new TypeError('client identity sourceの長さが不正です。');
    return createHmac('sha256', proxyToken).update(source, 'utf8').digest('hex');
}

export function isOpaqueClientId(value: string | null): value is string {
    if (value === null || !opaqueClientIdPattern.test(value)) return false;
    const actual = Buffer.from(value, 'ascii');
    const normalized = Buffer.from(value.toLowerCase(), 'ascii');
    return timingSafeEqual(actual, normalized);
}
