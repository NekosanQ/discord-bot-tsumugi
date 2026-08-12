import { cookies, headers } from 'next/headers';

import type { DashboardRequestContext } from '../../application/dashboard/DashboardGateway.js';
// Next App Router entrypoints use this single explicit composition bridge.
import { createDashboardComposition } from '../../bootstrap/createDashboardComposition.js';

export { createDashboardComposition };

export function readInternalClientId(requestHeaders: Headers): string {
    const clientId = requestHeaders.get('x-tsumugi-client-id');
    if (clientId === null || !/^[a-f0-9]{64}$/.test(clientId)) throw new TypeError('Web client identityを確立できません。');
    return clientId;
}

export async function getDashboardRequestContext(): Promise<DashboardRequestContext> {
    const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
    const cookieHeader = cookieStore
        .getAll()
        .map(({ name, value }): string => `${name}=${value}`)
        .join('; ');
    return { cookieHeader, clientId: readInternalClientId(requestHeaders) };
}
