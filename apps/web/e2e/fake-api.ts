import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const host = '127.0.0.1';
const port = 4010;
const webOrigin = 'http://localhost:3001';
const sessionCookie = 'fake_dashboard_session=authenticated';
const guildId = '12345678901234567';
const channelId = '22345678901234567';
const csrfToken = 'fake-csrf-token';
const proxyToken = 'fake-web-proxy-token-for-e2e-only';
let keywords: { guildId: string; channelId: string; trigger: string; responses: string[] }[] = [];

function withCookie(value: string): Record<string, string> {
    const headers: Record<string, string> = {};
    headers['set-cookie'] = value;
    return headers;
}

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    const responseHeaders = { ...headers };
    responseHeaders['content-type'] = 'application/json; charset=utf-8';
    responseHeaders['cache-control'] = 'no-store';
    response.writeHead(status, responseHeaders);
    response.end(JSON.stringify(body));
}

function redirect(response: ServerResponse, location: string): void {
    const headers: Record<string, string> = { location };
    headers['cache-control'] = 'no-store';
    response.writeHead(303, headers);
    response.end();
}

function sendNoContent(response: ServerResponse, headers: Record<string, string> = {}): void {
    const responseHeaders = { ...headers };
    responseHeaders['cache-control'] = 'no-store';
    response.writeHead(204, responseHeaders);
    response.end();
}

async function readJson(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function authenticated(request: IncomingMessage): boolean {
    return request.headers.cookie?.includes(sessionCookie) ?? false;
}

function mutationAuthorized(request: IncomingMessage): boolean {
    return request.headers.origin === webOrigin && request.headers['x-csrf-token'] === csrfToken;
}

function keywordPath(pathname: string): boolean {
    return pathname === `/v1/dashboard/guilds/${guildId}/channels/${channelId}/keywords`;
}

function deleteKeywordPath(pathname: string): boolean {
    return pathname === `/v1/dashboard/guilds/${guildId}/channels/${channelId}/keywords/delete`;
}

function proxyAuthorized(request: IncomingMessage): boolean {
    const clientId = request.headers['x-tsumugi-client-id'];
    return request.headers['x-tsumugi-web-proxy'] === proxyToken && typeof clientId === 'string' && /^[a-f0-9]{64}$/.test(clientId);
}

const server = createServer((request, response): void => {
    void (async (): Promise<void> => {
        const url = new URL(request.url ?? '/', `http://${host}:${String(port)}`);
        if (request.method === 'GET' && url.pathname === '/health/live') {
            sendJson(response, 200, { status: 'ok' });
            return;
        }
        if (url.pathname.startsWith('/v1/dashboard/') && !proxyAuthorized(request)) {
            sendJson(response, 401, { error: { code: 'unauthorized', message: 'proxy authentication failed' } });
            return;
        }
        if (request.method === 'GET' && url.pathname === '/v1/dashboard/auth/discord/start') {
            sendJson(
                response,
                200,
                { authorizationUrl: `http://${host}:${String(port)}/fake-discord/authorize` },
                withCookie('fake_oauth_attempt=valid; HttpOnly; SameSite=Lax; Path=/')
            );
            return;
        }
        if (request.method === 'GET' && url.pathname === '/fake-discord/authorize') {
            redirect(response, `${webOrigin}/auth/callback?code=fake-code&state=fake-state`);
            return;
        }
        if (request.method === 'GET' && url.pathname === '/v1/dashboard/auth/discord/callback') {
            if (url.searchParams.get('code') !== 'fake-code' || url.searchParams.get('state') !== 'fake-state') {
                sendJson(response, 400, { error: { code: 'invalid_request', message: 'invalid callback' } });
                return;
            }
            sendJson(response, 200, { returnTo: '/dashboard' }, withCookie(`${sessionCookie}; HttpOnly; SameSite=Lax; Path=/`));
            return;
        }
        if (request.method === 'GET' && url.pathname === '/v1/dashboard/session') {
            if (!authenticated(request)) {
                sendJson(response, 200, { authenticated: false });
                return;
            }
            sendJson(response, 200, {
                authenticated: true,
                user: { id: '32345678901234567', username: 'Dashboard Tester', avatarUrl: null },
                csrfToken
            });
            return;
        }
        if (!authenticated(request)) {
            sendJson(response, 401, { error: { code: 'unauthorized', message: 'login required' } });
            return;
        }
        if (request.method === 'POST' && url.pathname === '/v1/dashboard/logout') {
            if (!mutationAuthorized(request)) {
                sendJson(response, 403, { error: { code: 'forbidden', message: 'csrf rejected' } });
                return;
            }
            if (!request.headers['content-type']?.startsWith('application/json')) {
                sendJson(response, 415, { error: { code: 'invalid_request', message: 'json required' } });
                return;
            }
            const body = await readJson(request);
            if (typeof body !== 'object' || body === null || Array.isArray(body) || Object.keys(body).length !== 0) {
                sendJson(response, 400, { error: { code: 'invalid_request', message: 'empty object required' } });
                return;
            }
            sendNoContent(response, withCookie('fake_dashboard_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/'));
            return;
        }
        if (request.method === 'GET' && url.pathname === '/v1/dashboard/guilds') {
            sendJson(response, 200, { guilds: [{ id: guildId, name: 'Fake Guild', iconUrl: null, botInstalled: true }] });
            return;
        }
        if (request.method === 'GET' && url.pathname === `/v1/dashboard/guilds/${guildId}/channels`) {
            sendJson(response, 200, {
                guild: { id: guildId, name: 'Fake Guild', iconUrl: null, botInstalled: true },
                channels: [{ id: channelId, name: 'general', type: 'text' }]
            });
            return;
        }
        if (request.method === 'GET' && keywordPath(url.pathname)) {
            sendJson(response, 200, { keywords });
            return;
        }
        const keywordMutation =
            (request.method === 'PUT' && keywordPath(url.pathname)) || (request.method === 'POST' && deleteKeywordPath(url.pathname));
        if (keywordMutation) {
            if (!mutationAuthorized(request)) {
                sendJson(response, 403, { error: { code: 'forbidden', message: 'csrf rejected' } });
                return;
            }
            const body = (await readJson(request)) as { trigger?: unknown; responses?: unknown };
            if (typeof body.trigger !== 'string') {
                sendJson(response, 400, { error: { code: 'invalid_request', message: 'invalid trigger' } });
                return;
            }
            if (request.method === 'POST') {
                keywords = keywords.filter((keyword): boolean => keyword.trigger !== body.trigger);
            } else if (Array.isArray(body.responses) && body.responses.every((entry) => typeof entry === 'string')) {
                keywords = keywords.filter((keyword): boolean => keyword.trigger !== body.trigger);
                keywords.push({ guildId, channelId, trigger: body.trigger, responses: body.responses });
            }
            sendJson(response, 200, { ok: true });
            return;
        }
        sendJson(response, 404, { error: { code: 'not_found', message: 'not found' } });
    })().catch((): void => {
        if (!response.headersSent) sendJson(response, 500, { error: { code: 'internal_error', message: 'fake api error' } });
        else response.destroy();
    });
});

server.listen(port, host);

function shutdown(): void {
    server.close((): void => process.exit(0));
    server.closeAllConnections();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
