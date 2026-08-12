import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createOpaqueClientId, readWebApiProxyToken } from './infrastructure/security/clientIdentity.js';

const clientSeedPattern = /^[a-zA-Z0-9_-]{43}$/;

function clientCookieName(): string {
    return process.env.NODE_ENV === 'production' ? '__Host-tsumugi_client_id' : 'tsumugi_client_id';
}

function readForwardedIp(request: NextRequest): string | undefined {
    const value = request.headers.get('x-real-ip')?.trim();
    return value && isIP(value) !== 0 ? value : undefined;
}

function readClientSeed(request: NextRequest): { seed: string; issueCookie: boolean } {
    const forwardedIp = readForwardedIp(request);
    if (forwardedIp) return { seed: `ip:${forwardedIp}`, issueCookie: false };
    const existing = request.cookies.get(clientCookieName())?.value;
    if (existing && clientSeedPattern.test(existing)) return { seed: `cookie:${existing}`, issueCookie: false };
    return { seed: `cookie:${randomBytes(32).toString('base64url')}`, issueCookie: true };
}

function createContentSecurityPolicy(nonce: string): string {
    const development = process.env.NODE_ENV === 'development';
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
        `style-src 'self' 'nonce-${nonce}'`,
        "img-src 'self' data: https://cdn.discordapp.com",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        ...(development ? [] : ['upgrade-insecure-requests'])
    ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
    const identity = readClientSeed(request);
    const clientId = createOpaqueClientId(identity.seed, readWebApiProxyToken());
    const nonce = randomBytes(16).toString('base64');
    const contentSecurityPolicy = createContentSecurityPolicy(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tsumugi-client-id', clientId);
    requestHeaders.delete('x-real-ip');
    requestHeaders.delete('x-forwarded-for');

    const documentRequest = !request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/health/');
    if (documentRequest) {
        requestHeaders.set('x-nonce', nonce);
        requestHeaders.set('content-security-policy', contentSecurityPolicy);
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (documentRequest) response.headers.set('content-security-policy', contentSecurityPolicy);
    if (identity.issueCookie) {
        response.cookies.set({
            name: clientCookieName(),
            value: identity.seed.slice('cookie:'.length),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30
        });
    }
    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)']
};
