import type { DashboardUser, DiscordGuildMembership, ManagedChannelSnapshot } from '../../domain/dashboard/DashboardTypes.js';
import type { Keyword } from '../../domain/keyword/Keyword.js';
import type { KeywordScope } from '../keyword/KeywordRepository.js';

export interface DiscordOAuthTokens {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresAt: Date;
}

export interface DiscordOAuthGateway {
    createAuthorizationUrl: (state: string) => string;
    exchangeCode: (code: string) => Promise<DiscordOAuthTokens>;
    refresh: (refreshToken: string) => Promise<DiscordOAuthTokens>;
    revoke: (token: string) => Promise<void>;
    getCurrentUser: (accessToken: string) => Promise<DashboardUser>;
    listCurrentUserGuilds: (accessToken: string) => Promise<DiscordGuildMembership[]>;
}

export interface OAuthAttemptRecord {
    readonly stateHash: string;
    readonly returnTo: string;
    readonly expiresAt: Date;
}

export interface DashboardSessionRecord {
    readonly idHash: string;
    readonly user: DashboardUser;
    readonly accessTokenCiphertext: string;
    readonly refreshTokenCiphertext: string;
    readonly tokenExpiresAt: Date;
    readonly idleExpiresAt: Date;
    readonly absoluteExpiresAt: Date;
    readonly csrfHash: string;
    readonly revokedAt: Date | null;
}

export type CreateDashboardSessionRecord = Omit<DashboardSessionRecord, 'revokedAt'>;

export interface DashboardAuthRepository {
    createOAuthAttempt: (attempt: OAuthAttemptRecord) => Promise<void>;
    consumeOAuthAttempt: (stateHash: string, now: Date) => Promise<OAuthAttemptRecord | undefined>;
    createSession: (session: CreateDashboardSessionRecord) => Promise<void>;
    findSession: (idHash: string) => Promise<DashboardSessionRecord | undefined>;
    updateTokens: (
        idHash: string,
        tokens: Pick<DashboardSessionRecord, 'accessTokenCiphertext' | 'refreshTokenCiphertext' | 'tokenExpiresAt'>
    ) => Promise<void>;
    touchSession: (idHash: string, idleExpiresAt: Date, now: Date) => Promise<boolean>;
    revokeSession: (idHash: string, now: Date) => Promise<boolean>;
}

export interface SecretCodec {
    randomToken: () => string;
    digest: (value: string) => string;
    protect: (value: string) => string;
    unprotect: (value: string) => string;
    equals: (left: string, right: string) => boolean;
}

export type DashboardRateLimitBucket = 'oauthStart' | 'oauthCallback' | 'mutation';

export interface DashboardRateLimiter {
    consume: (bucket: DashboardRateLimitBucket, identifier: string) => Promise<boolean>;
}

export interface DashboardGuildProjection {
    readonly id: string;
    readonly botInstalled: boolean;
}

export interface DashboardProjectionRepository {
    syncGuild: (guildId: string, installed: boolean, channels: readonly ManagedChannelSnapshot[], correlationId: string) => Promise<void>;
    findGuilds: (guildIds: readonly string[]) => Promise<DashboardGuildProjection[]>;
    listAvailableChannels: (guildId: string) => Promise<ManagedChannelSnapshot[] | undefined>;
}

export interface DashboardKeywordRepository {
    list: (scope: KeywordScope) => Promise<Keyword[]>;
    saveWithAudit: (keyword: Keyword, actorId: string, correlationId: string) => Promise<void>;
    removeWithAudit: (scope: KeywordScope, trigger: string, actorId: string, correlationId: string) => Promise<boolean>;
}
