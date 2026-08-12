import { Buffer } from 'node:buffer';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
    assertSameOriginMutation,
    DashboardProxyPolicyError,
    parseDashboardMutationBody,
    resolveDashboardProxyTarget
} from '../../application/http/dashboardProxyPolicy.js';
import { createDashboardComposition, readInternalClientId } from './dashboard.js';
import { createProxiedResponse, jsonError } from './proxyResponse.js';

async function readBoundedBody(request: NextRequest, limit: number): Promise<Buffer> {
    const stream = request.body;
    if (stream === null) throw new DashboardProxyPolicyError(400, 'request bodyが必要です。');
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const result = await reader.read();
            if (result.done) break;
            size += result.value.byteLength;
            if (size > limit) throw new DashboardProxyPolicyError(413, 'request bodyが大きすぎます。');
            chunks.push(result.value);
        }
    } finally {
        reader.releaseLock();
    }
    return Buffer.concat(chunks, size);
}

function requireCsrfToken(request: NextRequest): string {
    const token = request.headers.get('x-csrf-token');
    if (!token || token.length > 512) throw new DashboardProxyPolicyError(403, 'CSRF tokenが必要です。');
    return token;
}

function normalizeContentType(request: NextRequest): string | undefined {
    const contentType = request.headers.get('content-type');
    if (!contentType) return undefined;
    return contentType.split(';', 1)[0]?.trim().toLowerCase();
}

export async function forwardDashboardRequest(request: NextRequest, segments: readonly string[]): Promise<NextResponse> {
    try {
        const target = resolveDashboardProxyTarget(request.method, segments);
        assertSameOriginMutation(request.method, request.nextUrl.origin, request.headers.get('origin'), request.headers.get('sec-fetch-site'));
        const composition = createDashboardComposition();
        const headers = new Headers();
        const cookieHeader = request.headers.get('cookie');
        if (cookieHeader) headers.set('cookie', cookieHeader);
        const origin = request.headers.get('origin');
        if (origin) headers.set('origin', origin);

        let body: BodyInit | undefined;
        if (target.method !== 'GET') {
            headers.set('x-csrf-token', requireCsrfToken(request));
        }
        if (target.apiPath === '/v1/dashboard/logout') {
            body = '{}';
            headers.set('content-type', 'application/json; charset=utf-8');
        }
        if (target.keywordMutation) {
            if (normalizeContentType(request) !== 'application/json') {
                throw new DashboardProxyPolicyError(415, 'application/jsonだけを受け付けます。');
            }
            const rawBody = await readBoundedBody(request, composition.requestBodyLimitBytes);
            let parsed: unknown;
            try {
                parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
            } catch {
                throw new DashboardProxyPolicyError(400, 'JSON形式が正しくありません。');
            }
            body = JSON.stringify(
                target.keywordMutation === 'save' ? parseDashboardMutationBody('save', parsed) : parseDashboardMutationBody('delete', parsed)
            );
            headers.set('content-type', 'application/json; charset=utf-8');
        }

        const upstream = await composition.transport.request(target.apiPath, {
            method: target.method,
            headers,
            body,
            clientId: readInternalClientId(request.headers)
        });
        return createProxiedResponse(upstream);
    } catch (error) {
        if (error instanceof DashboardProxyPolicyError) return jsonError(error.status, error.message);
        if (error instanceof DOMException && error.name === 'TimeoutError') return jsonError(504, 'ダッシュボードAPIが時間内に応答しませんでした。');
        return jsonError(502, 'ダッシュボードAPIへ接続できません。');
    }
}
