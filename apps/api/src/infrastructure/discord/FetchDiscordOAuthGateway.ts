import type { DiscordOAuthGateway, DiscordOAuthTokens } from '../../application/dashboard/DashboardPorts.js';
import { DashboardDependencyError } from '../../domain/dashboard/DashboardErrors.js';
import type { DashboardUser, DiscordGuildMembership } from '../../domain/dashboard/DashboardTypes.js';

export interface FetchDiscordOAuthGatewayConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    requestTimeoutMs: number;
}

export interface FetchDiscordOAuthGatewayOptions {
    fetch?: typeof fetch;
    clock?: () => Date;
}

function readRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('Discord responseはobjectである必要があります。');
    return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value !== 'string') throw new TypeError(`Discord responseの${key}が不正です。`);
    return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    if (value === null) return null;
    if (typeof value !== 'string') throw new TypeError(`Discord responseの${key}が不正です。`);
    return value;
}

export class FetchDiscordOAuthGateway implements DiscordOAuthGateway {
    private readonly fetchImplementation: typeof fetch;
    private readonly clock: () => Date;

    public constructor(
        private readonly config: FetchDiscordOAuthGatewayConfig,
        options: FetchDiscordOAuthGatewayOptions = {}
    ) {
        this.fetchImplementation = options.fetch ?? fetch;
        this.clock = options.clock ?? ((): Date => new Date());
    }

    public createAuthorizationUrl(state: string): string {
        const url = new URL('https://discord.com/oauth2/authorize');
        url.searchParams.set('client_id', this.config.clientId);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('redirect_uri', this.config.redirectUri);
        url.searchParams.set('scope', 'identify guilds');
        url.searchParams.set('state', state);
        return url.toString();
    }

    public exchangeCode(code: string): Promise<DiscordOAuthTokens> {
        const parameters = new URLSearchParams();
        parameters.set('grant_type', 'authorization_code');
        parameters.set('code', code);
        parameters.set('redirect_uri', this.config.redirectUri);
        return this.requestTokens(parameters);
    }

    public refresh(refreshToken: string): Promise<DiscordOAuthTokens> {
        const parameters = new URLSearchParams();
        parameters.set('grant_type', 'refresh_token');
        parameters.set('refresh_token', refreshToken);
        return this.requestTokens(parameters);
    }

    public async revoke(token: string): Promise<void> {
        const parameters = new URLSearchParams();
        parameters.set('token', token);
        parameters.set('token_type_hint', 'access_token');
        await this.request('/api/v10/oauth2/token/revoke', {
            method: 'POST',
            headers: this.formHeaders(),
            body: this.oauthForm(parameters)
        });
    }

    public async getCurrentUser(accessToken: string): Promise<DashboardUser> {
        const response = await this.request('/api/v10/users/@me', { headers: { authorization: `Bearer ${accessToken}` } });
        const record = readRecord(await response.json());
        const globalName = record.global_name;
        return {
            id: readString(record, 'id'),
            displayName: typeof globalName === 'string' && globalName.trim() ? globalName : readString(record, 'username'),
            avatarHash: readNullableString(record, 'avatar')
        };
    }

    public async listCurrentUserGuilds(accessToken: string): Promise<DiscordGuildMembership[]> {
        const guilds: DiscordGuildMembership[] = [];
        let after: string | undefined;
        for (;;) {
            const query = new URLSearchParams({ limit: '200' });
            if (after) query.set('after', after);
            const response = await this.request(`/api/v10/users/@me/guilds?${query.toString()}`, {
                headers: { authorization: `Bearer ${accessToken}` }
            });
            const value: unknown = await response.json();
            if (!Array.isArray(value)) throw new DashboardDependencyError('Discord guild一覧の形式が不正です。');
            const page = value.map((entry): DiscordGuildMembership => {
                const record = readRecord(entry);
                return {
                    id: readString(record, 'id'),
                    name: readString(record, 'name'),
                    iconHash: readNullableString(record, 'icon'),
                    owner: record.owner === true,
                    permissions: readString(record, 'permissions')
                };
            });
            guilds.push(...page);
            if (page.length < 200) return guilds;
            after = page.at(-1)?.id;
            if (!after) return guilds;
        }
    }

    private async requestTokens(parameters: URLSearchParams): Promise<DiscordOAuthTokens> {
        const response = await this.request('/api/v10/oauth2/token', {
            method: 'POST',
            headers: this.formHeaders(),
            body: this.oauthForm(parameters)
        });
        const record = readRecord(await response.json());
        const expiresIn = record.expires_in;
        if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
            throw new DashboardDependencyError('Discord OAuth token期限が不正です。');
        }
        return {
            accessToken: readString(record, 'access_token'),
            refreshToken: readString(record, 'refresh_token'),
            expiresAt: new Date(this.clock().getTime() + expiresIn * 1000)
        };
    }

    private oauthForm(parameters: URLSearchParams): URLSearchParams {
        const form = new URLSearchParams(parameters);
        form.set('client_id', this.config.clientId);
        form.set('client_secret', this.config.clientSecret);
        return form;
    }

    private formHeaders(): Headers {
        const headers = new Headers();
        headers.set('content-type', 'application/x-www-form-urlencoded');
        return headers;
    }

    private async request(path: string, init: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout((): void => {
            controller.abort();
        }, this.config.requestTimeoutMs);
        timeout.unref();
        try {
            const response = await this.fetchImplementation(`https://discord.com${path}`, { ...init, signal: controller.signal });
            if (!response.ok) throw new DashboardDependencyError(`Discord APIがstatus ${String(response.status)}を返しました。`);
            return response;
        } catch (error) {
            if (error instanceof DashboardDependencyError) throw error;
            throw new DashboardDependencyError('Discord APIへ接続できませんでした。', { cause: error });
        } finally {
            clearTimeout(timeout);
        }
    }
}
