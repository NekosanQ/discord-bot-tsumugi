import {
    type ApiErrorCode,
    ContractValidationError,
    parseApiErrorResponse,
    parseKeywordDto,
    parseKeywordListResponse,
    parseResolveKeywordResponse,
    type SyncGuildSnapshotRequest
} from '@tsumugi/contracts';

import type { GuildSnapshot, GuildSnapshotSynchronization } from '../../../application/guild/GuildSnapshotSynchronization.js';
import type { KeywordManagement, KeywordRecord, KeywordScope } from '../../../application/keyword/KeywordManagement.js';

export type HttpFetcher = (input: URL, init: RequestInit) => Promise<Response>;

export class KeywordApiError extends Error {
    public constructor(
        public readonly status: number,
        public readonly code: ApiErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'KeywordApiError';
    }
}

export class HttpKeywordManagementClient implements KeywordManagement, GuildSnapshotSynchronization {
    public constructor(
        private readonly baseUrl: string,
        private readonly serviceToken: string,
        private readonly timeoutMs: number,
        private readonly fetcher: HttpFetcher = fetch
    ) {}

    public async save(keyword: KeywordRecord): Promise<void> {
        await this.post('/v1/keywords/save', keyword);
    }

    public async remove(scope: KeywordScope, trigger: string): Promise<void> {
        await this.post('/v1/keywords/delete', { ...scope, trigger });
    }

    public async get(scope: KeywordScope, trigger: string): Promise<KeywordRecord> {
        return parseKeywordDto(await this.post('/v1/keywords/get', { ...scope, trigger }));
    }

    public async list(scope: KeywordScope): Promise<KeywordRecord[]> {
        return parseKeywordListResponse(await this.post('/v1/keywords/list', scope)).keywords;
    }

    public async resolve(scope: KeywordScope, content: string): Promise<{ trigger: string; response: string } | undefined> {
        return parseResolveKeywordResponse(await this.post('/v1/keywords/resolve', { ...scope, content })).match ?? undefined;
    }

    public async sync(snapshot: GuildSnapshot): Promise<void> {
        const request: SyncGuildSnapshotRequest = {
            guildId: snapshot.guildId,
            installed: snapshot.installed,
            channels: snapshot.channels.map((channel) => ({ ...channel }))
        };
        await this.request('PUT', '/v1/internal/guilds/snapshot', request);
    }

    private async post(pathname: string, body: unknown): Promise<unknown> {
        return this.request('POST', pathname, body);
    }

    private async request(method: 'POST' | 'PUT', pathname: string, body: unknown): Promise<unknown> {
        const headers = new Headers({ authorization: `Bearer ${this.serviceToken}` });
        headers.set('content-type', 'application/json');
        const response = await this.fetcher(new URL(pathname, this.baseUrl), {
            method,
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(this.timeoutMs)
        });
        if (response.status === 204) return undefined;
        const value: unknown = await response.json();
        if (!response.ok) {
            let code: ApiErrorCode = 'internal_error';
            let message = 'キーワードAPIの呼び出しに失敗しました。';
            try {
                const errorResponse = parseApiErrorResponse(value);
                code = errorResponse.error.code;
                message = errorResponse.error.message;
            } catch (error) {
                if (!(error instanceof ContractValidationError)) throw error;
            }
            throw new KeywordApiError(response.status, code, message);
        }
        return value;
    }
}
