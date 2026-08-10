import {
    DashboardAuthenticationError,
    DashboardCsrfError,
    DashboardDependencyError,
    OAuthStateError
} from '../../domain/dashboard/DashboardErrors.js';
import { type DashboardUser, normalizeDashboardReturnTo } from '../../domain/dashboard/DashboardTypes.js';
import type { DashboardAuthRepository, DashboardSessionRecord, DiscordOAuthGateway, SecretCodec } from './DashboardPorts.js';

export interface DashboardAuthConfig {
    oauthStateTtlMs: number;
    sessionIdleTtlMs: number;
    sessionAbsoluteTtlMs: number;
    tokenRefreshSkewMs: number;
}

export interface BeginOAuthResult {
    readonly authorizationUrl: string;
    readonly state: string;
}

export interface CompleteOAuthResult {
    readonly sessionId: string;
    readonly csrfToken: string;
    readonly returnTo: string;
}

export interface AuthenticatedDashboardSession {
    readonly user: DashboardUser;
    readonly accessToken: string;
    readonly csrfToken?: string;
}

export interface DashboardAuthServiceOptions {
    clock?: () => Date;
    reportRevokeError?: (error: unknown) => void;
}

export class DashboardAuthService {
    private readonly clock: () => Date;
    private readonly reportRevokeError: (error: unknown) => void;

    public constructor(
        private readonly repository: DashboardAuthRepository,
        private readonly discord: DiscordOAuthGateway,
        private readonly secrets: SecretCodec,
        private readonly config: DashboardAuthConfig,
        options: DashboardAuthServiceOptions = {}
    ) {
        this.clock = options.clock ?? ((): Date => new Date());
        this.reportRevokeError = options.reportRevokeError ?? ((): void => undefined);
    }

    public async beginOAuth(returnToValue?: string): Promise<BeginOAuthResult> {
        const state = this.secrets.randomToken();
        const now = this.clock();
        await this.repository.createOAuthAttempt({
            stateHash: this.secrets.digest(state),
            returnTo: normalizeDashboardReturnTo(returnToValue),
            expiresAt: new Date(now.getTime() + this.config.oauthStateTtlMs)
        });
        return { state, authorizationUrl: this.discord.createAuthorizationUrl(state) };
    }

    public async completeOAuth(code: string, state: string, stateCookie: string): Promise<CompleteOAuthResult> {
        if (!code || !state || !stateCookie || !this.secrets.equals(state, stateCookie)) throw new OAuthStateError();
        const attempt = await this.repository.consumeOAuthAttempt(this.secrets.digest(state), this.clock());
        if (!attempt) throw new OAuthStateError();

        try {
            const tokens = await this.discord.exchangeCode(code);
            const user = await this.discord.getCurrentUser(tokens.accessToken);
            const sessionId = this.secrets.randomToken();
            const csrfToken = this.secrets.randomToken();
            const now = this.clock();
            await this.repository.createSession({
                idHash: this.secrets.digest(sessionId),
                user,
                accessTokenCiphertext: this.secrets.protect(tokens.accessToken),
                refreshTokenCiphertext: this.secrets.protect(tokens.refreshToken),
                tokenExpiresAt: tokens.expiresAt,
                idleExpiresAt: new Date(now.getTime() + this.config.sessionIdleTtlMs),
                absoluteExpiresAt: new Date(now.getTime() + this.config.sessionAbsoluteTtlMs),
                csrfHash: this.secrets.digest(csrfToken)
            });
            return { sessionId, csrfToken, returnTo: attempt.returnTo };
        } catch (error) {
            if (error instanceof DashboardDependencyError) throw error;
            throw new DashboardDependencyError('Discord OAuthの完了処理に失敗しました。', { cause: error });
        }
    }

    public async authenticate(sessionId: string | undefined): Promise<AuthenticatedDashboardSession> {
        if (!sessionId) throw new DashboardAuthenticationError();
        const idHash = this.secrets.digest(sessionId);
        const session = await this.repository.findSession(idHash);
        if (!session) throw new DashboardAuthenticationError();
        return this.activateSession(session);
    }

    public async getSession(sessionId: string | undefined, csrfToken: string | undefined): Promise<AuthenticatedDashboardSession> {
        const authenticated = await this.authenticate(sessionId);
        const session = await this.repository.findSession(this.secrets.digest(sessionId ?? ''));
        if (!session || session.revokedAt || session.idleExpiresAt <= this.clock() || session.absoluteExpiresAt <= this.clock()) {
            throw new DashboardAuthenticationError();
        }
        if (!csrfToken || !this.secrets.equals(this.secrets.digest(csrfToken), session.csrfHash)) throw new DashboardCsrfError();
        return { ...authenticated, csrfToken };
    }

    public async verifyCsrf(sessionId: string | undefined, csrfCookie: string | undefined, csrfHeader: string | undefined): Promise<void> {
        if (!sessionId || !csrfCookie || !csrfHeader || !this.secrets.equals(csrfCookie, csrfHeader)) throw new DashboardCsrfError();
        const session = await this.repository.findSession(this.secrets.digest(sessionId));
        if (!session || !this.secrets.equals(this.secrets.digest(csrfCookie), session.csrfHash)) throw new DashboardCsrfError();
    }

    public async logout(sessionId: string | undefined): Promise<void> {
        if (!sessionId) return;
        const idHash = this.secrets.digest(sessionId);
        const session = await this.repository.findSession(idHash);
        if (!session) return;
        await this.repository.revokeSession(idHash, this.clock());
        try {
            await this.discord.revoke(this.secrets.unprotect(session.accessTokenCiphertext));
        } catch (error) {
            this.reportRevokeError(error);
        }
    }

    private async activateSession(session: DashboardSessionRecord): Promise<AuthenticatedDashboardSession> {
        const now = this.clock();
        if (session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
            throw new DashboardAuthenticationError();
        }

        let accessToken = this.secrets.unprotect(session.accessTokenCiphertext);
        if (session.tokenExpiresAt.getTime() - now.getTime() <= this.config.tokenRefreshSkewMs) {
            const refreshed = await this.discord.refresh(this.secrets.unprotect(session.refreshTokenCiphertext));
            accessToken = refreshed.accessToken;
            await this.repository.updateTokens(session.idHash, {
                accessTokenCiphertext: this.secrets.protect(refreshed.accessToken),
                refreshTokenCiphertext: this.secrets.protect(refreshed.refreshToken),
                tokenExpiresAt: refreshed.expiresAt
            });
        }

        const idleExpiresAt = new Date(Math.min(now.getTime() + this.config.sessionIdleTtlMs, session.absoluteExpiresAt.getTime()));
        const active = await this.repository.touchSession(session.idHash, idleExpiresAt, now);
        if (!active) throw new DashboardAuthenticationError();
        return { user: session.user, accessToken };
    }
}
