import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'toml';

/**
 * コンフィグファイルの構造
 */
export interface Config {
    clientId: string;
    guildId: string;
    botColor: string;
    errorColor: string;
    iconURL: string;
    inviteURL: string;
    announcementChannelId: string;
    botEntranceChannelId: string;
    supportGuildURL: string;
    errorEmoji: string;
    botEmoji: string;
    memberEmoji: string;
    emoji: string;
    gifEmoji: string;
    statusEmoji: Record<string, string>;
    channelEmoji: Record<string, string>;
    serverManagementApi: {
        baseUrl: string;
        timeoutMs: number;
    };
    cooldownStore: {
        maxMemoryEntries: number;
        connectTimeoutMs: number;
        commandTimeoutMs: number;
        reconnectBaseDelayMs: number;
        reconnectMaxDelayMs: number;
    };
}

export type ConfigLoadFailure = 'not-found' | 'invalid';

/** コンフィグの読み込みに失敗したことを表す起動時エラー */
export class ConfigLoadError extends Error {
    public constructor(
        public readonly configPath: string,
        public readonly reason: ConfigLoadFailure,
        options?: ErrorOptions
    ) {
        super(`コンフィグファイル(${configPath})の読み込みまたは解析に失敗しました。`, options);
        this.name = 'ConfigLoadError';
    }
}

export interface LoadConfigOptions {
    environment?: string;
    baseDirectory?: string;
    readFile?: (filePath: string) => string;
}

function defaultReadFile(filePath: string): string {
    return readFileSync(filePath, 'utf-8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value !== 'string') {
        throw new TypeError(`コンフィグ項目(${key})は文字列である必要があります。`);
    }
    return value;
}

function readStringRecord(record: Record<string, unknown>, key: string, requiredKeys: readonly string[]): Record<string, string> {
    const value = record[key];
    if (!isRecord(value)) {
        throw new TypeError(`コンフィグ項目(${key})はtableである必要があります。`);
    }

    const parsed: Record<string, string> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
        if (typeof entryValue !== 'string') {
            throw new TypeError(`コンフィグ項目(${key}.${entryKey})は文字列である必要があります。`);
        }
        parsed[entryKey] = entryValue;
    }
    for (const requiredKey of requiredKeys) {
        if (!(requiredKey in parsed)) {
            throw new TypeError(`コンフィグ項目(${key}.${requiredKey})がありません。`);
        }
    }
    return parsed;
}

function readServerManagementApi(record: Record<string, unknown>): Config['serverManagementApi'] {
    const value = record.serverManagementApi;
    if (value === undefined) return { baseUrl: 'http://api:3000', timeoutMs: 3000 };
    if (!isRecord(value) || typeof value.baseUrl !== 'string' || typeof value.timeoutMs !== 'number' || !Number.isInteger(value.timeoutMs)) {
        throw new TypeError('コンフィグ項目(serverManagementApi)が不正です。');
    }
    if (!value.baseUrl.startsWith('http://') && !value.baseUrl.startsWith('https://')) {
        throw new TypeError('serverManagementApi.baseUrlはHTTP URLである必要があります。');
    }
    if (value.timeoutMs < 1) throw new TypeError('serverManagementApi.timeoutMsは1以上である必要があります。');
    return { baseUrl: value.baseUrl, timeoutMs: value.timeoutMs };
}

function readInteger(record: Record<string, unknown>, key: string, minimum: number): number {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
        throw new TypeError(`コンフィグ項目(${key})は${String(minimum)}以上の整数である必要があります。`);
    }
    return value;
}

function readCooldownStore(record: Record<string, unknown>): Config['cooldownStore'] {
    const value = record.cooldownStore;
    if (value === undefined) {
        return {
            maxMemoryEntries: 100000,
            connectTimeoutMs: 500,
            commandTimeoutMs: 250,
            reconnectBaseDelayMs: 100,
            reconnectMaxDelayMs: 5000
        };
    }
    if (!isRecord(value)) throw new TypeError('コンフィグ項目(cooldownStore)はtableである必要があります。');
    const parsed = {
        maxMemoryEntries: readInteger(value, 'maxMemoryEntries', 1),
        connectTimeoutMs: readInteger(value, 'connectTimeoutMs', 1),
        commandTimeoutMs: readInteger(value, 'commandTimeoutMs', 1),
        reconnectBaseDelayMs: readInteger(value, 'reconnectBaseDelayMs', 1),
        reconnectMaxDelayMs: readInteger(value, 'reconnectMaxDelayMs', 1)
    };
    if (parsed.reconnectMaxDelayMs < parsed.reconnectBaseDelayMs) {
        throw new TypeError('cooldownStore.reconnectMaxDelayMsはreconnectBaseDelayMs以上である必要があります。');
    }
    return parsed;
}

function parseConfig(value: unknown): Config {
    if (!isRecord(value)) {
        throw new TypeError('コンフィグのrootはtableである必要があります。');
    }

    const configValue: Config = {
        clientId: readString(value, 'clientId'),
        guildId: readString(value, 'guildId'),
        botColor: readString(value, 'botColor'),
        errorColor: readString(value, 'errorColor'),
        iconURL: readString(value, 'iconURL'),
        inviteURL: readString(value, 'inviteURL'),
        announcementChannelId: readString(value, 'announcementChannelId'),
        botEntranceChannelId: readString(value, 'botEntranceChannelId'),
        supportGuildURL: readString(value, 'supportGuildURL'),
        errorEmoji: readString(value, 'errorEmoji'),
        botEmoji: readString(value, 'botEmoji'),
        memberEmoji: readString(value, 'memberEmoji'),
        emoji: readString(value, 'emoji'),
        gifEmoji: readString(value, 'gifEmoji'),
        statusEmoji: readStringRecord(value, 'statusEmoji', ['online', 'idle', 'dnd', 'streaming', 'invisible']),
        channelEmoji: readStringRecord(value, 'channelEmoji', [
            'publicText',
            'lockedText',
            'publicVoice',
            'lockedVoice',
            'publicAnnouncement',
            'lockedAnnouncement',
            'publicStage',
            'lockedStage',
            'category'
        ]),
        serverManagementApi: readServerManagementApi(value),
        cooldownStore: readCooldownStore(value)
    };

    if (!configValue.guildId.trim()) {
        throw new TypeError('コンフィグ項目(guildId)は空にできません。');
    }

    return configValue;
}

/**
 * コンフィグを明示的に読み込む。
 * この関数はprocessを終了せず、失敗を呼び出し元へ返す。
 */
export function loadConfig(options: LoadConfigOptions = {}): Config {
    const environment = options.environment ?? process.env.NODE_ENV ?? 'development';
    const baseDirectory = options.baseDirectory ?? process.cwd();
    const absoluteConfigPath = path.resolve(baseDirectory, 'config', `${environment}.toml`);
    const readFile = options.readFile ?? defaultReadFile;

    try {
        return parseConfig(parse(readFile(absoluteConfigPath)));
    } catch (error) {
        const reason = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not-found' : 'invalid';
        throw new ConfigLoadError(absoluteConfigPath, reason, { cause: error });
    }
}

let currentConfig: Config | undefined;

/** production bootstrapから一度だけ設定するlegacy互換境界 */
export function initializeConfig(value: Config): void {
    if (currentConfig !== undefined && currentConfig !== value) {
        throw new Error('コンフィグは既に初期化されています。');
    }
    currentConfig = value;
}

/** 依存構築に失敗した場合だけ、設定bridgeを未初期化状態へ戻す */
export function resetConfigAfterFailedInitialization(value: Config): void {
    if (currentConfig === value) {
        currentConfig = undefined;
    }
}

/**
 * 未移行コード向けの遅延取得。
 * 新規コードはConfigをconstructorまたはfactoryから受け取る。
 */
export function getConfig(): Config {
    currentConfig ??= loadConfig();
    return currentConfig;
}

/**
 * 既存のimportを段階的に削除するための読み取り専用bridge。
 * import時にはファイルI/Oを行わない。
 */
export const config: Config = new Proxy({} as Config, {
    get(_target, property): unknown {
        return getConfig()[property as keyof Config];
    }
});
