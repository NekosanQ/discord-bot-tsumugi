import { parseApiErrorResponse } from '@tsumugi/contracts';

import { isOpaqueClientId } from '../security/clientIdentity.js';
import { DashboardApiError } from './DashboardApiError.js';

export interface DashboardApiRequest {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    cookieHeader?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    clientId: string;
}

export class DashboardApiTransport {
    public constructor(
        private readonly baseUrl: URL,
        private readonly timeoutMs: number,
        private readonly proxyToken: string
    ) {}

    public request(pathname: string, request: DashboardApiRequest): Promise<Response> {
        if (!pathname.startsWith('/v1/dashboard/')) throw new TypeError('dashboard API以外へは接続できません。');
        if (!isOpaqueClientId(request.clientId)) throw new TypeError('client identityが不正です。');
        const url = new URL(pathname, this.baseUrl);
        const headers = new Headers(request.headers);
        headers.set('accept', 'application/json');
        headers.set('x-tsumugi-web-proxy', this.proxyToken);
        headers.set('x-tsumugi-client-id', request.clientId);
        if (request.cookieHeader) headers.set('cookie', request.cookieHeader);
        headers.delete('authorization');

        return fetch(url, {
            method: request.method ?? 'GET',
            headers,
            body: request.body,
            cache: 'no-store',
            redirect: 'manual',
            signal: AbortSignal.timeout(this.timeoutMs)
        });
    }

    public async requestJson(pathname: string, cookieHeader: string, clientId: string): Promise<unknown> {
        const response = await this.request(pathname, { cookieHeader, clientId });
        const body: unknown = await response.json().catch((): null => null);
        if (!response.ok) {
            let message = 'ダッシュボードAPIを利用できません。';
            try {
                message = parseApiErrorResponse(body).error.message;
            } catch {
                // Internal response details are intentionally not surfaced.
            }
            throw new DashboardApiError(response.status, message);
        }
        return body;
    }
}
