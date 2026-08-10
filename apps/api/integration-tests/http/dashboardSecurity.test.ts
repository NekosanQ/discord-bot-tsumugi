import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';

import { DashboardAuthService } from '../../src/application/dashboard/DashboardAuthService.js';
import type {
    CreateDashboardSessionRecord,
    DashboardAuthRepository,
    DashboardGuildProjection,
    DashboardKeywordRepository,
    DashboardProjectionRepository,
    DashboardSessionRecord,
    DiscordOAuthGateway,
    DiscordOAuthTokens,
    OAuthAttemptRecord
} from '../../src/application/dashboard/DashboardPorts.js';
import { DashboardService } from '../../src/application/dashboard/DashboardService.js';
import { DashboardSnapshotService } from '../../src/application/dashboard/DashboardSnapshotService.js';
import type { KeywordScope } from '../../src/application/keyword/KeywordRepository.js';
import type { DashboardUser, DiscordGuildMembership, ManagedChannelSnapshot } from '../../src/domain/dashboard/DashboardTypes.js';
import type { Keyword } from '../../src/domain/keyword/Keyword.js';
import { AesGcmSecretCodec } from '../../src/infrastructure/security/AesGcmSecretCodec.js';
import { InMemoryDashboardRateLimiter } from '../../src/infrastructure/security/InMemoryDashboardRateLimiter.js';
import { createDashboardHttpHandler } from '../../src/interface-adapter/http/dashboard/createDashboardHttpHandler.js';

class EmptyAuthRepository implements DashboardAuthRepository {
    public createOAuthAttempt(): Promise<void> {
        return Promise.resolve();
    }

    public consumeOAuthAttempt(): Promise<OAuthAttemptRecord | undefined> {
        return Promise.resolve(undefined);
    }

    public createSession(_session: CreateDashboardSessionRecord): Promise<void> {
        return Promise.resolve();
    }

    public findSession(): Promise<DashboardSessionRecord | undefined> {
        return Promise.resolve(undefined);
    }

    public updateTokens(): Promise<void> {
        return Promise.resolve();
    }

    public touchSession(): Promise<void> {
        return Promise.resolve();
    }

    public revokeSession(): Promise<void> {
        return Promise.resolve();
    }
}

class FakeDiscordGateway implements DiscordOAuthGateway {
    public createAuthorizationUrl(state: string): string {
        return `https://discord.test/oauth?state=${state}`;
    }

    public exchangeCode(): Promise<DiscordOAuthTokens> {
        return Promise.reject(new Error('not used'));
    }

    public refresh(): Promise<DiscordOAuthTokens> {
        return Promise.reject(new Error('not used'));
    }

    public revoke(): Promise<void> {
        return Promise.resolve();
    }

    public getCurrentUser(): Promise<DashboardUser> {
        return Promise.reject(new Error('not used'));
    }

    public listCurrentUserGuilds(): Promise<DiscordGuildMembership[]> {
        return Promise.resolve([]);
    }
}

class EmptyProjection implements DashboardProjectionRepository {
    public syncGuild(): Promise<void> {
        return Promise.resolve();
    }

    public findGuilds(): Promise<DashboardGuildProjection[]> {
        return Promise.resolve([]);
    }

    public listAvailableChannels(): Promise<ManagedChannelSnapshot[] | undefined> {
        return Promise.resolve(undefined);
    }
}

class EmptyKeywords implements DashboardKeywordRepository {
    public list(): Promise<Keyword[]> {
        return Promise.resolve([]);
    }

    public saveWithAudit(): Promise<void> {
        return Promise.resolve();
    }

    public removeWithAudit(_scope: KeywordScope): Promise<boolean> {
        return Promise.resolve(false);
    }
}

async function listen(server: Server): Promise<number> {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server addressを取得できません。');
    return address.port;
}

void test('dashboard user sessionとinternal service認証を相互利用させない', async (): Promise<void> => {
    const repository = new EmptyAuthRepository();
    const discord = new FakeDiscordGateway();
    const secrets = new AesGcmSecretCodec(Buffer.alloc(32, 1).toString('base64'), Buffer.alloc(32, 2).toString('base64'));
    const auth = new DashboardAuthService(repository, discord, secrets, {
        oauthStateTtlMs: 600000,
        sessionIdleTtlMs: 28800000,
        sessionAbsoluteTtlMs: 604800000,
        tokenRefreshSkewMs: 60000
    });
    const projection = new EmptyProjection();
    const handler = createDashboardHttpHandler({
        serviceToken: 'service-token-that-is-long-enough-for-test',
        origin: 'https://dashboard.test',
        secureCookies: true,
        requestBodyLimitBytes: 16384,
        oauthStateTtlMs: 600000,
        sessionAbsoluteTtlMs: 604800000,
        auth,
        dashboard: new DashboardService(auth, discord, projection, new EmptyKeywords()),
        snapshots: new DashboardSnapshotService(projection),
        rateLimiter: new InMemoryDashboardRateLimiter({
            windowMs: 60000,
            limits: { oauthStart: 10, oauthCallback: 20, mutation: 30 }
        }),
        reportError: (): void => undefined
    });
    const server = createServer((request, response): void => {
        void handler(request, response);
    });
    const port = await listen(server);

    try {
        const start = await fetch(`http://127.0.0.1:${String(port)}/v1/dashboard/auth/discord/start`);
        assert.equal(start.status, 200);
        const stateCookie = start.headers.get('set-cookie');
        assert.match(stateCookie ?? '', /__Host-tsumugi_oauth_state=/);
        assert.match(stateCookie ?? '', /Secure/);
        assert.match(stateCookie ?? '', /HttpOnly/);
        assert.match(stateCookie ?? '', /SameSite=Lax/);

        const internalHeaders = new Headers();
        internalHeaders.set('cookie', stateCookie ?? '');
        internalHeaders.set('content-type', 'application/json');
        const internalWithUserCookie = await fetch(`http://127.0.0.1:${String(port)}/v1/internal/guilds/snapshot`, {
            method: 'PUT',
            headers: internalHeaders,
            body: JSON.stringify({ guildId: '12345678901234567', installed: false, channels: [] })
        });
        assert.equal(internalWithUserCookie.status, 401);

        const dashboardWithServiceBearer = await fetch(`http://127.0.0.1:${String(port)}/v1/dashboard/guilds`, {
            headers: { authorization: 'Bearer service-token-that-is-long-enough-for-test' }
        });
        assert.equal(dashboardWithServiceBearer.status, 401);
    } finally {
        await new Promise<void>((resolve, reject) =>
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            })
        );
    }
});
