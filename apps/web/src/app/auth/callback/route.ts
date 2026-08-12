import { parseCompleteDiscordOAuthResponse } from '@tsumugi/contracts';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { safeReturnTo } from '../../../application/http/dashboardProxyPolicy.js';
import { createDashboardComposition, readInternalClientId } from '../../_composition/dashboard.js';
import { copySetCookieHeaders } from '../../_composition/proxyResponse.js';

const forwardedParameters = ['code', 'state', 'error', 'error_description'] as const;

function callbackQuery(request: NextRequest): URLSearchParams {
    const query = new URLSearchParams();
    for (const name of forwardedParameters) {
        const value = request.nextUrl.searchParams.get(name);
        if (value !== null && value.length <= 2048) query.set(name, value);
    }
    return query;
}

async function get(request: NextRequest): Promise<NextResponse> {
    let upstream: Response | undefined;
    try {
        const composition = createDashboardComposition();
        upstream = await composition.transport.request(`/v1/dashboard/auth/discord/callback?${callbackQuery(request).toString()}`, {
            cookieHeader: request.headers.get('cookie') ?? undefined,
            clientId: readInternalClientId(request.headers)
        });
        if (!upstream.ok) throw new Error('OAuth callback failed');
        const result = parseCompleteDiscordOAuthResponse((await upstream.json()) as unknown);
        const response = NextResponse.redirect(new URL(safeReturnTo(result.returnTo), request.url), 303);
        response.headers.set('cache-control', 'no-store');
        copySetCookieHeaders(upstream.headers, response.headers);
        return response;
    } catch {
        const response = NextResponse.redirect(new URL('/?auth=failed', request.url), 303);
        response.headers.set('cache-control', 'no-store');
        if (upstream) copySetCookieHeaders(upstream.headers, response.headers);
        return response;
    }
}

export { get as GET };
