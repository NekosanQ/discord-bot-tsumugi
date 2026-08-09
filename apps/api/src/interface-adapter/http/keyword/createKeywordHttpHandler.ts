import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
    type ApiErrorCode,
    type ApiErrorResponse,
    ContractValidationError,
    parseDeleteKeywordRequest,
    parseListKeywordsRequest,
    parseResolveKeywordRequest,
    parseSaveKeywordRequest,
    parseSetGuildInstallationRequest
} from '@tsumugi/contracts';

import type { ManagedGuildService } from '../../../application/guild/ManagedGuildService.js';
import { KeywordDependencyError, KeywordNotFoundError, ManagedChannelOwnershipError } from '../../../application/keyword/KeywordApplicationErrors.js';
import type { KeywordService } from '../../../application/keyword/KeywordService.js';
import { KeywordValidationError } from '../../../domain/keyword/KeywordErrors.js';

export interface KeywordHttpHandlerOptions {
    serviceToken: string;
    requestBodyLimitBytes: number;
    readiness: () => Promise<boolean>;
    optionalHealth?: () => Promise<Record<string, unknown>>;
    metrics?: () => Promise<string>;
    reportError: (error: unknown) => void;
}

class RequestBodyTooLargeError extends Error {}

function authorized(header: string | undefined, expectedToken: string): boolean {
    if (!header?.startsWith('Bearer ')) return false;
    const provided = Buffer.from(header.slice(7));
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
    response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, status: number, code: ApiErrorCode, message: string): void {
    const body: ApiErrorResponse = { error: { code, message } };
    sendJson(response, status, body);
}

function sendNoContent(response: ServerResponse): void {
    response.statusCode = 204;
    response.end();
}

function sendText(response: ServerResponse, status: number, body: string): void {
    response.statusCode = status;
    response.setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(body);
}

export function createKeywordHttpHandler(service: KeywordService, guildService: ManagedGuildService, options: KeywordHttpHandlerOptions) {
    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        if (request.method === 'GET' && request.url === '/health/live') {
            sendJson(response, 200, { status: 'ok' });
            return;
        }
        if (request.method === 'GET' && request.url === '/health/ready') {
            const [ready, optionalDependencies] = await Promise.all([options.readiness(), options.optionalHealth?.() ?? Promise.resolve({})]);
            sendJson(response, ready ? 200 : 503, {
                status: ready ? 'ready' : 'unavailable',
                dependencies: { mysql: ready ? 'ready' : 'unavailable', ...optionalDependencies }
            });
            return;
        }
        if (request.method === 'GET' && request.url === '/metrics') {
            if (!authorized(request.headers.authorization, options.serviceToken)) {
                sendError(response, 401, 'unauthorized', 'service認証に失敗しました。');
                return;
            }
            sendText(response, 200, (await options.metrics?.()) ?? '');
            return;
        }
        if (request.method !== 'POST') {
            sendError(response, 404, 'not_found', 'endpointが見つかりません。');
            return;
        }
        if (!authorized(request.headers.authorization, options.serviceToken)) {
            sendError(response, 401, 'unauthorized', 'service認証に失敗しました。');
            return;
        }

        try {
            const body = await readJson(request, options.requestBodyLimitBytes);
            switch (request.url) {
                case '/v1/keywords/save': {
                    const keyword = await service.save(parseSaveKeywordRequest(body));
                    sendJson(response, 200, keyword);
                    return;
                }
                case '/v1/keywords/delete': {
                    const command = parseDeleteKeywordRequest(body);
                    await service.remove(command, command.trigger);
                    sendNoContent(response);
                    return;
                }
                case '/v1/keywords/get': {
                    const query = parseDeleteKeywordRequest(body);
                    sendJson(response, 200, await service.get(query, query.trigger));
                    return;
                }
                case '/v1/keywords/list': {
                    const scope = parseListKeywordsRequest(body);
                    sendJson(response, 200, { keywords: await service.list(scope) });
                    return;
                }
                case '/v1/keywords/resolve': {
                    const query = parseResolveKeywordRequest(body);
                    sendJson(response, 200, { match: await service.resolve(query, query.content) });
                    return;
                }
                case '/v1/guilds/installation': {
                    const command = parseSetGuildInstallationRequest(body);
                    await guildService.setInstallation(command.guildId, command.installed);
                    sendNoContent(response);
                    return;
                }
                default:
                    sendError(response, 404, 'not_found', 'endpointが見つかりません。');
            }
        } catch (error) {
            if (error instanceof ContractValidationError || error instanceof KeywordValidationError || error instanceof SyntaxError) {
                sendError(response, 400, 'invalid_request', error.message);
            } else if (error instanceof KeywordNotFoundError) {
                sendError(response, 404, 'not_found', error.message);
            } else if (error instanceof ManagedChannelOwnershipError) {
                sendError(response, 409, 'conflict', error.message);
            } else if (error instanceof RequestBodyTooLargeError) {
                sendError(response, 413, 'invalid_request', 'request bodyが大きすぎます。');
            } else if (error instanceof KeywordDependencyError) {
                options.reportError(error);
                sendError(response, 503, 'dependency_failure', '永続化サービスを利用できません。');
            } else {
                options.reportError(error);
                sendError(response, 500, 'internal_error', '予期しないエラーが発生しました。');
            }
        }
    };
}
