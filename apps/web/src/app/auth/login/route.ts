import { parseStartDiscordOAuthResponse } from '@tsumugi/contracts';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { safeReturnTo } from '../../../application/http/dashboardProxyPolicy.js';
import { createDashboardComposition, readInternalClientId } from '../../_composition/dashboard.js';
import { copySetCookieHeaders } from '../../_composition/proxyResponse.js';

function validAuthorizationUrl(value: string): boolean {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'discord.com' && url.pathname === '/oauth2/authorize') return true;
    return process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
}

async function get(request: NextRequest): Promise<NextResponse> {
    try {
        const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'));
        const composition = createDashboardComposition();
        const upstream = await composition.transport.request(`/v1/dashboard/auth/discord/start?returnTo=${encodeURIComponent(returnTo)}`, {
            cookieHeader: request.headers.get('cookie') ?? undefined,
            clientId: readInternalClientId(request.headers)
        });
        if (!upstream.ok) return NextResponse.redirect(new URL('/?auth=unavailable', request.url), 303);
        const parsed = parseStartDiscordOAuthResponse((await upstream.json()) as unknown);
        if (!validAuthorizationUrl(parsed.authorizationUrl)) return NextResponse.redirect(new URL('/?auth=invalid', request.url), 303);
        const response = NextResponse.redirect(parsed.authorizationUrl, 303);
        response.headers.set('cache-control', 'no-store');
        copySetCookieHeaders(upstream.headers, response.headers);
        return response;
    } catch {
        return NextResponse.redirect(new URL('/?auth=unavailable', request.url), 303);
    }
}

export { get as GET };
