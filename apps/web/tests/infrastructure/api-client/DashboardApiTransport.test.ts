import assert from 'node:assert/strict';
import test from 'node:test';

import { DashboardApiTransport } from '../../../src/infrastructure/api-client/DashboardApiTransport.js';

void test('API transportは内部dashboard pathと最小headerだけを送信する', async (): Promise<void> => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';
    let capturedHeaders = new Headers();
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        capturedUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        capturedHeaders = new Headers(init?.headers);
        return Promise.resolve(Response.json({ authenticated: false }));
    };

    try {
        const transport = new DashboardApiTransport(new URL('http://api.internal:3000'), 1000, 'proxy-secret-from-server'.repeat(2));
        const suppliedHeaders = new Headers();
        suppliedHeaders.set('authorization', 'Bearer must-not-leak');
        suppliedHeaders.set('x-tsumugi-web-proxy', 'browser-value');
        suppliedHeaders.set('x-tsumugi-client-id', 'browser-value');
        await transport.request('/v1/dashboard/session', {
            cookieHeader: 'session=opaque',
            clientId: 'a'.repeat(64),
            headers: suppliedHeaders
        });
        assert.equal(capturedUrl, 'http://api.internal:3000/v1/dashboard/session');
        assert.equal(capturedHeaders.get('cookie'), 'session=opaque');
        assert.equal(capturedHeaders.has('authorization'), false);
        assert.equal(capturedHeaders.get('x-tsumugi-web-proxy'), 'proxy-secret-from-server'.repeat(2));
        assert.equal(capturedHeaders.get('x-tsumugi-client-id'), 'a'.repeat(64));
        assert.throws((): void => {
            void transport.request('/metrics', { clientId: 'a'.repeat(64) });
        }, /dashboard API/);
        assert.throws((): void => {
            void transport.request('/v1/dashboard/session', { clientId: 'browser-value' });
        }, /client identity/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
