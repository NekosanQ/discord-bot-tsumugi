import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
    type ApiErrorCode,
    type ApiErrorResponse,
    ContractValidationError,
    parseDeleteDashboardKeywordRequest,
    parseSaveDashboardKeywordRequest,
    parseSyncGuildSnapshotRequest
} from '@tsumugi/contracts';

import type { DashboardAuthService } from '../../../application/dashboard/DashboardAuthService.js';
import type { DashboardRateLimiter } from '../../../application/dashboard/DashboardPorts.js';
import type { DashboardService } from '../../../application/dashboard/DashboardService.js';
import type { DashboardSnapshotService } from '../../../application/dashboard/DashboardSnapshotService.js';
import { KeywordNotFoundError, ManagedChannelOwnershipError } from '../../../application/keyword/KeywordApplicationErrors.js';
import {
    DashboardAuthenticationError,
    DashboardAuthorizationError,
    DashboardCsrfError,
    DashboardDependencyError,
    DashboardRateLimitError,
    DashboardValidationError,
    ManagedDashboardResourceError,
    OAuthStateError
} from '../../../domain/dashboard/DashboardErrors.js';
import { KeywordValidationError } from '../../../domain/keyword/KeywordErrors.js';

export interface DashboardHttpHandlerOptions {
    serviceToken: string;
    webProxyToken: string;
    origin: string;
    secureCookies: boolean;
    requestBodyLimitBytes: number;
    oauthStateTtlMs: number;
    sessionAbsoluteTtlMs: number;
    auth: DashboardAuthService;
    dashboard: DashboardService;
    snapshots: DashboardSnapshotService;
    rateLimiter: DashboardRateLimiter;
    reportError: (error: unknown) => void;
}

class RequestBodyTooLargeError extends Error {}

function authorized(header: string | undefined, expectedToken: string): boolean {
    if (!header?.startsWith('Bearer ')) return false;
    const provided = Buffer.from(header.slice(7));
    const expected = Buffer.from(expectedToken);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function authorizedProxy(header: string | string[] | undefined, expectedToken: string): boolean {
    if (typeof header !== 'string') return false;
    const provided = Buffer.from(header);
    const expected = Buffer.from(expectedToken);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function readJson(request: IncomingMessage, limit: number): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        size += buffer.length;
        if (size > limit) throw new RequestBodyTooLargeError();
        chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.setHeader('vary', 'cookie');
    response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, status: number, code: ApiErrorCode, message: string): void {
    const body: ApiErrorResponse = { error: { code, message } };
    sendJson(response, status, body);
}

function sendNoContent(response: ServerResponse): void {
    response.statusCode = 204;
    response.setHeader('cache-control', 'no-store');
    response.end();
}

function parseCookies(header: string | undefined): ReadonlyMap<string, string> {
    const cookies = new Map<string, string>();
    for (const part of header?.split(';') ?? []) {
        const separator = part.indexOf('=');
        if (separator <= 0) continue;
        const name = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (name && !cookies.has(name)) cookies.set(name, value);
    }
    return cookies;
}

function cookieNames(secure: boolean): { session: string; csrf: string; state: string } {
    const prefix = secure ? '__Host-' : '';
    return { session: `${prefix}tsumugi_session`, csrf: `${prefix}tsumugi_csrf`, state: `${prefix}tsumugi_oauth_state` };
}

function serializeCookie(
    name: string,
    value: string,
    options: { secure: boolean; httpOnly: boolean; sameSite: 'Lax' | 'Strict'; maxAgeSeconds: number }
): string {
    const attributes = [`${name}=${value}`, 'Path=/', `Max-Age=${String(options.maxAgeSeconds)}`, `SameSite=${options.sameSite}`];
    if (options.httpOnly) attributes.push('HttpOnly');
    if (options.secure) attributes.push('Secure');
    return attributes.join('; ');
}

function clearCookie(name: string, secure: boolean, httpOnly: boolean, sameSite: 'Lax' | 'Strict'): string {
    return serializeCookie(name, '', { secure, httpOnly, sameSite, maxAgeSeconds: 0 });
}

function assertMutationRequest(request: IncomingMessage, origin: string): void {
    if (request.headers.origin !== origin) throw new DashboardCsrfError('Origin検証に失敗しました。');
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        throw new ContractValidationError('mutationはapplication/jsonで送信してください。');
    }
}

function clientIdentifier(request: IncomingMessage): string {
    const proxyIdentifier = request.headers['x-tsumugi-client-id'];
    if (typeof proxyIdentifier === 'string' && /^[a-f0-9]{64}$/.test(proxyIdentifier)) return proxyIdentifier;
    return request.socket.remoteAddress ?? 'unknown';
}

async function enforceRateLimit(
    rateLimiter: DashboardRateLimiter,
    bucket: 'oauthStart' | 'oauthCallback' | 'mutation',
    identifier: string
): Promise<void> {
    try {
        if (!(await rateLimiter.consume(bucket, identifier))) throw new DashboardRateLimitError();
    } catch (error) {
        if (error instanceof DashboardRateLimitError) throw error;
        throw new DashboardDependencyError('セキュリティrate limitを利用できません。', { cause: error });
    }
}

export function createDashboardHttpHandler(options: DashboardHttpHandlerOptions) {
    const names = cookieNames(options.secureCookies);
    const stateMaxAgeSeconds = Math.ceil(options.oauthStateTtlMs / 1000);
    const sessionMaxAgeSeconds = Math.ceil(options.sessionAbsoluteTtlMs / 1000);

    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        const requestUrl = new URL(request.url ?? '/', 'http://api.internal');
        const correlationId = randomUUID();
        response.setHeader('x-correlation-id', correlationId);
        const cookies = parseCookies(request.headers.cookie);
        const sessionId = cookies.get(names.session);
        const csrfCookie = cookies.get(names.csrf);

        try {
            if (requestUrl.pathname.startsWith('/v1/dashboard/') && !authorizedProxy(request.headers['x-tsumugi-web-proxy'], options.webProxyToken)) {
                sendError(response, 401, 'unauthorized', 'Web proxy認証に失敗しました。');
                return;
            }
            if (request.method === 'GET' && requestUrl.pathname === '/v1/dashboard/auth/discord/start') {
                await enforceRateLimit(options.rateLimiter, 'oauthStart', clientIdentifier(request));
                const result = await options.auth.beginOAuth(requestUrl.searchParams.get('returnTo') ?? undefined);
                response.setHeader(
                    'set-cookie',
                    serializeCookie(names.state, result.state, {
                        secure: options.secureCookies,
                        httpOnly: true,
                        sameSite: 'Lax',
                        maxAgeSeconds: stateMaxAgeSeconds
                    })
                );
                sendJson(response, 200, { authorizationUrl: result.authorizationUrl });
                return;
            }

            if (request.method === 'GET' && requestUrl.pathname === '/v1/dashboard/auth/discord/callback') {
                await enforceRateLimit(options.rateLimiter, 'oauthCallback', clientIdentifier(request));
                const result = await options.auth.completeOAuth(
                    requestUrl.searchParams.get('code') ?? '',
                    requestUrl.searchParams.get('state') ?? '',
                    cookies.get(names.state) ?? ''
                );
                response.setHeader('set-cookie', [
                    serializeCookie(names.session, result.sessionId, {
                        secure: options.secureCookies,
                        httpOnly: true,
                        sameSite: 'Lax',
                        maxAgeSeconds: sessionMaxAgeSeconds
                    }),
                    serializeCookie(names.csrf, result.csrfToken, {
                        secure: options.secureCookies,
                        httpOnly: false,
                        sameSite: 'Strict',
                        maxAgeSeconds: sessionMaxAgeSeconds
                    }),
                    clearCookie(names.state, options.secureCookies, true, 'Lax')
                ]);
                sendJson(response, 200, { returnTo: result.returnTo });
                return;
            }

            if (request.method === 'GET' && requestUrl.pathname === '/v1/dashboard/session') {
                try {
                    const session = await options.auth.getSession(sessionId, csrfCookie);
                    sendJson(response, 200, {
                        authenticated: true,
                        user: {
                            id: session.user.id,
                            username: session.user.displayName,
                            avatarUrl: session.user.avatarHash
                                ? `https://cdn.discordapp.com/avatars/${session.user.id}/${session.user.avatarHash}.png?size=128`
                                : null
                        },
                        csrfToken: session.csrfToken
                    });
                } catch (error) {
                    if (!(error instanceof DashboardAuthenticationError || error instanceof DashboardCsrfError)) throw error;
                    sendJson(response, 200, { authenticated: false });
                }
                return;
            }

            if (request.method === 'POST' && requestUrl.pathname === '/v1/dashboard/logout') {
                assertMutationRequest(request, options.origin);
                await options.auth.verifyCsrf(sessionId, csrfCookie, request.headers['x-csrf-token'] as string | undefined);
                await enforceRateLimit(options.rateLimiter, 'mutation', sessionId ?? 'anonymous');
                await options.auth.logout(sessionId);
                response.setHeader('set-cookie', [
                    clearCookie(names.session, options.secureCookies, true, 'Lax'),
                    clearCookie(names.csrf, options.secureCookies, false, 'Strict')
                ]);
                sendNoContent(response);
                return;
            }

            if (request.method === 'GET' && requestUrl.pathname === '/v1/dashboard/guilds') {
                sendJson(response, 200, { guilds: await options.dashboard.listGuilds(sessionId) });
                return;
            }

            const channelsRoute = /^\/v1\/dashboard\/guilds\/(\d{17,20})\/channels$/.exec(requestUrl.pathname);
            if (request.method === 'GET' && channelsRoute) {
                sendJson(response, 200, await options.dashboard.getGuild(sessionId, channelsRoute[1]));
                return;
            }

            const keywordsRoute = /^\/v1\/dashboard\/guilds\/(\d{17,20})\/channels\/(\d{17,20})\/keywords$/.exec(requestUrl.pathname);
            if (request.method === 'GET' && keywordsRoute) {
                sendJson(response, 200, await options.dashboard.listKeywords(sessionId, keywordsRoute[1], keywordsRoute[2]));
                return;
            }
            if (request.method === 'PUT' && keywordsRoute) {
                assertMutationRequest(request, options.origin);
                await options.auth.verifyCsrf(sessionId, csrfCookie, request.headers['x-csrf-token'] as string | undefined);
                await enforceRateLimit(options.rateLimiter, 'mutation', `${sessionId ?? 'anonymous'}:${keywordsRoute[1]}`);
                const body = parseSaveDashboardKeywordRequest(await readJson(request, options.requestBodyLimitBytes));
                sendJson(
                    response,
                    200,
                    await options.dashboard.saveKeyword(sessionId, keywordsRoute[1], keywordsRoute[2], body.trigger, body.responses, correlationId)
                );
                return;
            }

            const deleteRoute = /^\/v1\/dashboard\/guilds\/(\d{17,20})\/channels\/(\d{17,20})\/keywords\/delete$/.exec(requestUrl.pathname);
            if (request.method === 'POST' && deleteRoute) {
                assertMutationRequest(request, options.origin);
                await options.auth.verifyCsrf(sessionId, csrfCookie, request.headers['x-csrf-token'] as string | undefined);
                await enforceRateLimit(options.rateLimiter, 'mutation', `${sessionId ?? 'anonymous'}:${deleteRoute[1]}`);
                const body = parseDeleteDashboardKeywordRequest(await readJson(request, options.requestBodyLimitBytes));
                await options.dashboard.removeKeyword(sessionId, deleteRoute[1], deleteRoute[2], body.trigger, correlationId);
                sendNoContent(response);
                return;
            }

            if (request.method === 'PUT' && requestUrl.pathname === '/v1/internal/guilds/snapshot') {
                if (!authorized(request.headers.authorization, options.serviceToken)) {
                    sendError(response, 401, 'unauthorized', 'service認証に失敗しました。');
                    return;
                }
                const body = parseSyncGuildSnapshotRequest(await readJson(request, options.requestBodyLimitBytes));
                await options.snapshots.sync(body.guildId, body.installed, body.channels, correlationId);
                sendNoContent(response);
                return;
            }

            sendError(response, 404, 'not_found', 'endpointが見つかりません。');
        } catch (error) {
            if (
                error instanceof ContractValidationError ||
                error instanceof KeywordValidationError ||
                error instanceof DashboardValidationError ||
                error instanceof SyntaxError ||
                error instanceof OAuthStateError
            ) {
                sendError(response, 400, 'invalid_request', error.message);
            } else if (error instanceof DashboardAuthenticationError) {
                sendError(response, 401, 'unauthorized', error.message);
            } else if (error instanceof DashboardAuthorizationError || error instanceof DashboardCsrfError) {
                sendError(response, 403, 'forbidden', error.message);
            } else if (error instanceof KeywordNotFoundError || error instanceof ManagedDashboardResourceError) {
                sendError(response, 404, 'not_found', error.message);
            } else if (error instanceof ManagedChannelOwnershipError) {
                sendError(response, 409, 'conflict', error.message);
            } else if (error instanceof DashboardRateLimitError) {
                response.setHeader('retry-after', '60');
                sendError(response, 429, 'rate_limited', error.message);
            } else if (error instanceof RequestBodyTooLargeError) {
                sendError(response, 413, 'invalid_request', 'request bodyが大きすぎます。');
            } else if (error instanceof DashboardDependencyError) {
                options.reportError(error);
                sendError(response, 503, 'dependency_failure', '依存サービスを利用できません。');
            } else {
                options.reportError(error);
                sendError(response, 500, 'internal_error', '予期しないエラーが発生しました。');
            }
        }
    };
}
