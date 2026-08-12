import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import { forwardDashboardRequest } from '../../src/app/_composition/dashboardProxy.js';

void test('logout proxyはCSRF付き空JSONを送り204を透過する', async (): Promise<void> => {
    const originalFetch = globalThis.fetch;
    const originalApiUrl = process.env.WEB_INTERNAL_API_URL;
    const originalProxyToken = process.env.WEB_API_PROXY_TOKEN;
    process.env.WEB_INTERNAL_API_URL = 'http://api.internal:3000';
    process.env.WEB_API_PROXY_TOKEN = 'proxy-secret-from-server'.repeat(2);

    globalThis.fetch = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const requestInit = init ?? {};
        const headers = new Headers(requestInit.headers);
        assert.equal(requestInit.method, 'POST');
        assert.equal(headers.get('origin'), 'https://dashboard.example');
        assert.equal(headers.get('x-csrf-token'), 'csrf-token');
        assert.equal(headers.get('content-type'), 'application/json; charset=utf-8');
        assert.equal(requestInit.body, '{}');
        const responseHeaders = new Headers();
        responseHeaders.set('x-correlation-id', 'integration-correlation-id');
        return Promise.resolve(new Response(null, { status: 204, headers: responseHeaders }));
    };

    try {
        const headers = new Headers();
        headers.set('origin', 'https://dashboard.example');
        headers.set('sec-fetch-site', 'same-origin');
        headers.set('x-csrf-token', 'csrf-token');
        headers.set('x-tsumugi-client-id', 'a'.repeat(64));
        const request = new NextRequest('https://dashboard.example/api/dashboard/logout', { method: 'POST', headers });
        const response = await forwardDashboardRequest(request, ['logout']);
        assert.equal(response.status, 204);
        assert.equal(response.headers.get('x-correlation-id'), 'integration-correlation-id');
    } finally {
        globalThis.fetch = originalFetch;
        process.env.WEB_INTERNAL_API_URL = originalApiUrl;
        process.env.WEB_API_PROXY_TOKEN = originalProxyToken;
    }
});
