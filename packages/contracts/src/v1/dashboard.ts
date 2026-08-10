import { ContractValidationError, type KeywordDto, parseKeywordDto } from './keyword.js';

export interface DashboardUserDto {
    id: string;
    username: string;
    avatarUrl: string | null;
}

export interface DashboardSessionResponse {
    authenticated: boolean;
    user?: DashboardUserDto;
    csrfToken?: string;
}

export interface DashboardGuildDto {
    id: string;
    name: string;
    iconUrl: string | null;
    botInstalled: boolean;
}

export interface DashboardGuildListResponse {
    guilds: DashboardGuildDto[];
}

export type DashboardChannelType = 'text' | 'announcement';

export interface DashboardChannelDto {
    id: string;
    name: string;
    type: DashboardChannelType;
}

export interface DashboardGuildResponse {
    guild: DashboardGuildDto;
    channels: DashboardChannelDto[];
}

export interface DashboardKeywordListResponse {
    keywords: KeywordDto[];
}

export interface StartDiscordOAuthResponse {
    authorizationUrl: string;
}

export interface CompleteDiscordOAuthResponse {
    returnTo: string;
}

export interface SaveDashboardKeywordRequest {
    trigger: string;
    responses: string[];
}

export interface DeleteDashboardKeywordRequest {
    trigger: string;
}

export interface ManagedChannelSnapshotDto {
    id: string;
    name: string;
    type: DashboardChannelType;
}

export interface SyncGuildSnapshotRequest {
    guildId: string;
    installed: boolean;
    channels: ManagedChannelSnapshotDto[];
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

function readBoolean(record: Record<string, unknown>, key: string): boolean {
    const value = record[key];
    if (typeof value !== 'boolean') throw new ContractValidationError(`${key}はbooleanである必要があります。`);
    return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    if (value === null) return null;
    if (typeof value !== 'string') throw new ContractValidationError(`${key}は文字列またはnullである必要があります。`);
    return value;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
    const value = record[key];
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
        throw new ContractValidationError(`${key}は文字列配列である必要があります。`);
    }
    return value as string[];
}

export function parseDashboardUserDto(value: unknown): DashboardUserDto {
    const record = readRecord(value);
    return { id: readString(record, 'id'), username: readString(record, 'username'), avatarUrl: readNullableString(record, 'avatarUrl') };
}

export function parseDashboardSessionResponse(value: unknown): DashboardSessionResponse {
    const record = readRecord(value);
    const authenticated = readBoolean(record, 'authenticated');
    if (!authenticated) return { authenticated: false };
    return {
        authenticated: true,
        user: parseDashboardUserDto(record.user),
        csrfToken: readString(record, 'csrfToken')
    };
}

export function parseDashboardGuildDto(value: unknown): DashboardGuildDto {
    const record = readRecord(value);
    return {
        id: readString(record, 'id'),
        name: readString(record, 'name'),
        iconUrl: readNullableString(record, 'iconUrl'),
        botInstalled: readBoolean(record, 'botInstalled')
    };
}

export function parseDashboardGuildListResponse(value: unknown): DashboardGuildListResponse {
    const record = readRecord(value);
    if (!Array.isArray(record.guilds)) throw new ContractValidationError('guildsは配列である必要があります。');
    return { guilds: record.guilds.map(parseDashboardGuildDto) };
}

export function parseDashboardChannelDto(value: unknown): DashboardChannelDto {
    const record = readRecord(value);
    const type = readString(record, 'type');
    if (type !== 'text' && type !== 'announcement') throw new ContractValidationError('未知のchannel typeです。');
    return { id: readString(record, 'id'), name: readString(record, 'name'), type };
}

export function parseDashboardGuildResponse(value: unknown): DashboardGuildResponse {
    const record = readRecord(value);
    if (!Array.isArray(record.channels)) throw new ContractValidationError('channelsは配列である必要があります。');
    return { guild: parseDashboardGuildDto(record.guild), channels: record.channels.map(parseDashboardChannelDto) };
}

export function parseDashboardKeywordListResponse(value: unknown): DashboardKeywordListResponse {
    const record = readRecord(value);
    if (!Array.isArray(record.keywords)) throw new ContractValidationError('keywordsは配列である必要があります。');
    return { keywords: record.keywords.map(parseKeywordDto) };
}

export function parseStartDiscordOAuthResponse(value: unknown): StartDiscordOAuthResponse {
    return { authorizationUrl: readString(readRecord(value), 'authorizationUrl') };
}

export function parseCompleteDiscordOAuthResponse(value: unknown): CompleteDiscordOAuthResponse {
    return { returnTo: readString(readRecord(value), 'returnTo') };
}

export function parseSaveDashboardKeywordRequest(value: unknown): SaveDashboardKeywordRequest {
    const record = readRecord(value);
    return { trigger: readString(record, 'trigger'), responses: readStringArray(record, 'responses') };
}

export function parseDeleteDashboardKeywordRequest(value: unknown): DeleteDashboardKeywordRequest {
    return { trigger: readString(readRecord(value), 'trigger') };
}

export function parseSyncGuildSnapshotRequest(value: unknown): SyncGuildSnapshotRequest {
    const record = readRecord(value);
    if (!Array.isArray(record.channels)) throw new ContractValidationError('channelsは配列である必要があります。');
    return {
        guildId: readString(record, 'guildId'),
        installed: readBoolean(record, 'installed'),
        channels: record.channels.map((entry): ManagedChannelSnapshotDto => {
            const channel = parseDashboardChannelDto(entry);
            return { id: channel.id, name: channel.name, type: channel.type };
        })
    };
}
