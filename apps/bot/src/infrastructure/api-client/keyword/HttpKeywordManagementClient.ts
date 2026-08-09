import {
    type ApiErrorCode,
    ContractValidationError,
    parseApiErrorResponse,
    parseKeywordDto,
    parseKeywordListResponse,
    parseResolveKeywordResponse
} from '@tsumugi/contracts';

import type { GuildInstallationManagement } from '../../../application/guild/GuildInstallationManagement.js';
import type { KeywordManagement, KeywordRecord, KeywordScope } from '../../../application/keyword/KeywordManagement.js';

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

export class HttpKeywordManagementClient implements KeywordManagement, GuildInstallationManagement {
    public constructor(
        private readonly baseUrl: string,
        private readonly serviceToken: string,
        private readonly timeoutMs: number
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

    public async setInstallation(guildId: string, installed: boolean): Promise<void> {
        await this.post('/v1/guilds/installation', { guildId, installed });
    }

    private async post(pathname: string, body: unknown): Promise<unknown> {
        const headers = new Headers({ authorization: `Bearer ${this.serviceToken}` });
        headers.set('content-type', 'application/json');
        const response = await fetch(new URL(pathname, this.baseUrl), {
            method: 'POST',
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
