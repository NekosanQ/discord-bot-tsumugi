export interface KeywordScopeDto {
    guildId: string;
    channelId: string;
}

export interface KeywordDto extends KeywordScopeDto {
    trigger: string;
    responses: string[];
}

export type SaveKeywordRequest = KeywordDto;

export interface DeleteKeywordRequest extends KeywordScopeDto {
    trigger: string;
}

export type GetKeywordRequest = DeleteKeywordRequest;
export type ListKeywordsRequest = KeywordScopeDto;

export interface ResolveKeywordRequest extends KeywordScopeDto {
    content: string;
}

export interface KeywordListResponse {
    keywords: KeywordDto[];
}

export interface ResolveKeywordResponse {
    match: { trigger: string; response: string } | null;
}

export type ApiErrorCode = 'invalid_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'dependency_failure' | 'internal_error';

export interface ApiErrorResponse {
    error: {
        code: ApiErrorCode;
        message: string;
    };
}

export class ContractValidationError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'ContractValidationError';
    }
}

function readRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ContractValidationError('objectが必要です。');
    return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value !== 'string') throw new ContractValidationError(`${key}は文字列である必要があります。`);
    return value;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
    const value = record[key];
    if (!Array.isArray(value)) throw new ContractValidationError(`${key}は文字列配列である必要があります。`);

    const parsed: string[] = [];
    for (const entry of value) {
        if (typeof entry !== 'string') throw new ContractValidationError(`${key}は文字列配列である必要があります。`);
        parsed.push(entry);
    }
    return parsed;
}

export function parseKeywordDto(value: unknown): KeywordDto {
    const record = readRecord(value);
    return {
        guildId: readString(record, 'guildId'),
        channelId: readString(record, 'channelId'),
        trigger: readString(record, 'trigger'),
        responses: readStringArray(record, 'responses')
    };
}

export function parseSaveKeywordRequest(value: unknown): SaveKeywordRequest {
    return parseKeywordDto(value);
}

export function parseDeleteKeywordRequest(value: unknown): DeleteKeywordRequest {
    const record = readRecord(value);
    return {
        guildId: readString(record, 'guildId'),
        channelId: readString(record, 'channelId'),
        trigger: readString(record, 'trigger')
    };
}

export function parseListKeywordsRequest(value: unknown): ListKeywordsRequest {
    const record = readRecord(value);
    return { guildId: readString(record, 'guildId'), channelId: readString(record, 'channelId') };
}

export function parseResolveKeywordRequest(value: unknown): ResolveKeywordRequest {
    const record = readRecord(value);
    return { ...parseListKeywordsRequest(record), content: readString(record, 'content') };
}

export function parseKeywordListResponse(value: unknown): KeywordListResponse {
    const record = readRecord(value);
    const keywords = record.keywords;
    if (!Array.isArray(keywords)) throw new ContractValidationError('keywordsは配列である必要があります。');
    return { keywords: keywords.map(parseKeywordDto) };
}

export function parseResolveKeywordResponse(value: unknown): ResolveKeywordResponse {
    const record = readRecord(value);
    if (record.match === null) return { match: null };
    const match = readRecord(record.match);
    return { match: { trigger: readString(match, 'trigger'), response: readString(match, 'response') } };
}
