import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthenticatedDashboardSession } from '../../../src/application/dashboard/DashboardAuthService.js';
import type {
    DashboardKeywordRepository,
    DashboardProjectionRepository,
    DiscordOAuthGateway,
    DiscordOAuthTokens
} from '../../../src/application/dashboard/DashboardPorts.js';
import { DashboardService } from '../../../src/application/dashboard/DashboardService.js';
import type { KeywordLookupCache } from '../../../src/application/keyword/KeywordLookupCache.js';
import type { KeywordScope } from '../../../src/application/keyword/KeywordRepository.js';
import type { DashboardUser, DiscordGuildMembership, ManagedChannelSnapshot } from '../../../src/domain/dashboard/DashboardTypes.js';
import type { Keyword } from '../../../src/domain/keyword/Keyword.js';

const guildId = '12345678901234567';
const channelId = '22345678901234567';

function createService(
    events: string[],
    invalidate: (scope: KeywordScope) => Promise<void>,
    reportCacheError: (error: unknown) => void = (): void => undefined
): DashboardService {
    const session: AuthenticatedDashboardSession = {
        user: { id: '32345678901234567', displayName: 'tester', avatarHash: null },
        accessToken: 'access-token'
    };
    const auth = { authenticate: (): Promise<AuthenticatedDashboardSession> => Promise.resolve(session) };
    const membership: DiscordGuildMembership = {
        id: guildId,
        name: 'Guild',
        iconHash: null,
        owner: false,
        permissions: '32'
    };
    const discord: DiscordOAuthGateway = {
        createAuthorizationUrl: (): string => '',
        exchangeCode: (): Promise<DiscordOAuthTokens> => Promise.reject(new Error('unused')),
        refresh: (): Promise<DiscordOAuthTokens> => Promise.reject(new Error('unused')),
        revoke: (): Promise<void> => Promise.resolve(),
        getCurrentUser: (): Promise<DashboardUser> => Promise.reject(new Error('unused')),
        listCurrentUserGuilds: (): Promise<DiscordGuildMembership[]> => Promise.resolve([membership])
    };
    const projection: DashboardProjectionRepository = {
        syncGuild: (): Promise<void> => Promise.resolve(),
        findGuilds: (): Promise<{ id: string; botInstalled: boolean }[]> => Promise.resolve([{ id: guildId, botInstalled: true }]),
        listAvailableChannels: (): Promise<ManagedChannelSnapshot[]> => Promise.resolve([])
    };
    const keywords: DashboardKeywordRepository = {
        list: (): Promise<Keyword[]> => Promise.resolve([]),
        saveWithAudit: (): Promise<void> => {
            events.push('save');
            return Promise.resolve();
        },
        removeWithAudit: (): Promise<boolean> => Promise.resolve(true)
    };
    const cache: KeywordLookupCache = {
        get: (): Promise<undefined> => Promise.resolve(undefined),
        set: (): Promise<void> => Promise.resolve(),
        invalidate
    };
    return new DashboardService(auth, discord, projection, keywords, cache, reportCacheError);
}

void test('dashboard保存はDBと監査のcommit後にkeyword cacheを無効化する', async (): Promise<void> => {
    const events: string[] = [];
    const service = createService(events, (scope): Promise<void> => {
        assert.deepEqual(scope, { guildId, channelId });
        events.push('invalidate');
        return Promise.resolve();
    });

    await service.saveKeyword('session', guildId, channelId, 'hello', ['world'], 'correlation-id');

    assert.deepEqual(events, ['save', 'invalidate']);
});

void test('cache無効化失敗でもcommit済みdashboard保存を成功として返す', async (): Promise<void> => {
    const events: string[] = [];
    const cacheError = new Error('cache unavailable');
    let reported: unknown;
    const service = createService(
        events,
        (): Promise<void> => Promise.reject(cacheError),
        (error): void => {
            reported = error;
        }
    );

    const result = await service.saveKeyword('session', guildId, channelId, 'hello', ['world'], 'correlation-id');

    assert.equal(result.trigger, 'hello');
    assert.equal(reported, cacheError);
    assert.deepEqual(events, ['save']);
});
