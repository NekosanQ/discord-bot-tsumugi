import { NextResponse } from 'next/server';

export function readSetCookieHeaders(headers: Headers): string[] {
    const candidate: unknown = Reflect.get(headers, 'getSetCookie');
    if (typeof candidate === 'function') {
        const value: unknown = Reflect.apply(candidate, headers, []);
        if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value;
    }
    const single = headers.get('set-cookie');
    return single ? [single] : [];
}

export function copySetCookieHeaders(source: Headers, destination: Headers): void {
    for (const cookie of readSetCookieHeaders(source)) destination.append('set-cookie', cookie);
}

export function createProxiedResponse(upstream: Response): NextResponse {
    const headers = new Headers();
    for (const name of ['content-type', 'retry-after', 'x-correlation-id']) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }
    headers.set('cache-control', 'no-store');
    copySetCookieHeaders(upstream.headers, headers);
    return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export function jsonError(status: number, message: string): NextResponse {
    const headers = new Headers();
    headers.set('cache-control', 'no-store');
    const code =
        status === 400 || status === 413 || status === 415
            ? 'invalid_request'
            : status === 403
              ? 'forbidden'
              : status === 404
                ? 'not_found'
                : 'dependency_failure';
    return NextResponse.json({ error: { code, message } }, { status, headers });
}
