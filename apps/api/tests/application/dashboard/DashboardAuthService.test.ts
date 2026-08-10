import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DashboardAuthService } from '../../../src/application/dashboard/DashboardAuthService.js';
import type {
    CreateDashboardSessionRecord,
    DashboardAuthRepository,
    DashboardSessionRecord,
    DiscordOAuthGateway,
    DiscordOAuthTokens,
    OAuthAttemptRecord
} from '../../../src/application/dashboard/DashboardPorts.js';
import { DashboardCsrfError, OAuthStateError } from '../../../src/domain/dashboard/DashboardErrors.js';
import type { DashboardUser, DiscordGuildMembership } from '../../../src/domain/dashboard/DashboardTypes.js';
import { AesGcmSecretCodec } from '../../../src/infrastructure/security/AesGcmSecretCodec.js';

class MemoryAuthRepository implements DashboardAuthRepository {
    public readonly attempts = new Map<string, OAuthAttemptRecord & { consumed: boolean }>();
    public readonly sessions = new Map<string, DashboardSessionRecord>();

    public createOAuthAttempt(attempt: OAuthAttemptRecord): Promise<void> {
        this.attempts.set(attempt.stateHash, { ...attempt, consumed: false });
        return Promise.resolve();
    }

    public consumeOAuthAttempt(stateHash: string, now: Date): Promise<OAuthAttemptRecord | undefined> {
        const attempt = this.attempts.get(stateHash);
        if (!attempt || attempt.consumed || attempt.expiresAt <= now) return Promise.resolve(undefined);
        attempt.consumed = true;
        return Promise.resolve(attempt);
    }

    public createSession(session: CreateDashboardSessionRecord): Promise<void> {
        this.sessions.set(session.idHash, { ...session, revokedAt: null });
        return Promise.resolve();
    }

    public findSession(idHash: string): Promise<DashboardSessionRecord | undefined> {
        return Promise.resolve(this.sessions.get(idHash));
    }

    public updateTokens(
        idHash: string,
        tokens: Pick<DashboardSessionRecord, 'accessTokenCiphertext' | 'refreshTokenCiphertext' | 'tokenExpiresAt'>
    ): Promise<void> {
        const session = this.sessions.get(idHash);
        if (session) this.sessions.set(idHash, { ...session, ...tokens });
        return Promise.resolve();
    }

    public touchSession(idHash: string, idleExpiresAt: Date, now: Date): Promise<boolean> {
        const session = this.sessions.get(idHash);
        if (!session || session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) return Promise.resolve(false);
        this.sessions.set(idHash, { ...session, idleExpiresAt });
        return Promise.resolve(true);
    }

    public revokeSession(idHash: string, now: Date): Promise<void> {
        const session = this.sessions.get(idHash);
        if (session) this.sessions.set(idHash, { ...session, revokedAt: now });
        return Promise.resolve();
    }
}

class FakeDiscordGateway implements DiscordOAuthGateway {
    public refreshCount = 0;
    public revokeCount = 0;

    public constructor(private readonly clock: () => Date) {}

    public createAuthorizationUrl(state: string): string {
        return `https://discord.test/oauth?state=${encodeURIComponent(state)}`;
    }

    public exchangeCode(): Promise<DiscordOAuthTokens> {
        return Promise.resolve({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(this.clock().getTime() + 30000)
        });
    }

    public refresh(): Promise<DiscordOAuthTokens> {
        this.refreshCount += 1;
        return Promise.resolve({
            accessToken: 'refreshed-access-token',
            refreshToken: 'refreshed-refresh-token',
            expiresAt: new Date(this.clock().getTime() + 3600000)
        });
    }

    public revoke(): Promise<void> {
        this.revokeCount += 1;
        return Promise.resolve();
    }

    public getCurrentUser(): Promise<DashboardUser> {
        return Promise.resolve({ id: '12345678901234567', displayName: 'Tsumugi', avatarHash: null });
    }

    public listCurrentUserGuilds(): Promise<DiscordGuildMembership[]> {
        return Promise.resolve([]);
    }
}

function createFixture(): {
    service: DashboardAuthService;
    repository: MemoryAuthRepository;
    discord: FakeDiscordGateway;
} {
    const now = new Date('2026-08-10T00:00:00.000Z');
    const clock = (): Date => new Date(now);
    const repository = new MemoryAuthRepository();
    const discord = new FakeDiscordGateway(clock);
    const codec = new AesGcmSecretCodec(Buffer.alloc(32, 1).toString('base64'), Buffer.alloc(32, 2).toString('base64'));
    return {
        service: new DashboardAuthService(
            repository,
            discord,
            codec,
            {
                oauthStateTtlMs: 600000,
                sessionIdleTtlMs: 28800000,
                sessionAbsoluteTtlMs: 604800000,
                tokenRefreshSkewMs: 60000
            },
            { clock }
        ),
        repository,
        discord
    };
}

void describe('DashboardAuthService', (): void => {
    void it('stateを一回だけ消費しsessionとCSRFを発行する', async (): Promise<void> => {
        const { service } = createFixture();
        const started = await service.beginOAuth('/dashboard/123');
        const completed = await service.completeOAuth('code', started.state, started.state);
        assert.equal(completed.returnTo, '/dashboard/123');
        const session = await service.getSession(completed.sessionId, completed.csrfToken);
        assert.equal(session.user.displayName, 'Tsumugi');
        await assert.rejects(() => service.completeOAuth('code', started.state, started.state), OAuthStateError);
    });

    void it('外部returnToをdashboard rootへ戻す', async (): Promise<void> => {
        const { service } = createFixture();
        const started = await service.beginOAuth('https://evil.example/');
        const completed = await service.completeOAuth('code', started.state, started.state);
        assert.equal(completed.returnTo, '/dashboard');
    });

    void it('期限が近いaccess tokenをrefreshしCSRF不一致を拒否する', async (): Promise<void> => {
        const { service, discord } = createFixture();
        const started = await service.beginOAuth();
        const completed = await service.completeOAuth('code', started.state, started.state);
        const session = await service.authenticate(completed.sessionId);
        assert.equal(session.accessToken, 'refreshed-access-token');
        assert.equal(discord.refreshCount, 1);
        await assert.rejects(() => service.verifyCsrf(completed.sessionId, completed.csrfToken, 'different'), DashboardCsrfError);
    });

    void it('logoutはlocal sessionを無効化してDiscord revokeを試行する', async (): Promise<void> => {
        const { service, discord } = createFixture();
        const started = await service.beginOAuth();
        const completed = await service.completeOAuth('code', started.state, started.state);
        await service.logout(completed.sessionId);
        assert.equal(discord.revokeCount, 1);
        await assert.rejects(() => service.authenticate(completed.sessionId));
    });
});
