import {
    type DashboardGuildListResponse,
    type DashboardGuildResponse,
    type DashboardKeywordListResponse,
    type DashboardSessionResponse,
    parseDashboardGuildListResponse,
    parseDashboardGuildResponse,
    parseDashboardKeywordListResponse,
    parseDashboardSessionResponse
} from '@tsumugi/contracts';

import type { DashboardGateway, DashboardRequestContext } from '../../application/dashboard/DashboardGateway.js';
import type { DashboardApiTransport } from './DashboardApiTransport.js';

export class HttpDashboardGateway implements DashboardGateway {
    public constructor(private readonly transport: DashboardApiTransport) {}

    public async getSession(context: DashboardRequestContext): Promise<DashboardSessionResponse> {
        return parseDashboardSessionResponse(await this.transport.requestJson('/v1/dashboard/session', context.cookieHeader, context.clientId));
    }

    public async listGuilds(context: DashboardRequestContext): Promise<DashboardGuildListResponse> {
        return parseDashboardGuildListResponse(await this.transport.requestJson('/v1/dashboard/guilds', context.cookieHeader, context.clientId));
    }

    public async getGuild(context: DashboardRequestContext, guildId: string): Promise<DashboardGuildResponse> {
        return parseDashboardGuildResponse(
            await this.transport.requestJson(`/v1/dashboard/guilds/${encodeURIComponent(guildId)}/channels`, context.cookieHeader, context.clientId)
        );
    }

    public async listKeywords(context: DashboardRequestContext, guildId: string, channelId: string): Promise<DashboardKeywordListResponse> {
        const path = `/v1/dashboard/guilds/${encodeURIComponent(guildId)}/channels/${encodeURIComponent(channelId)}/keywords`;
        return parseDashboardKeywordListResponse(await this.transport.requestJson(path, context.cookieHeader, context.clientId));
    }
}
