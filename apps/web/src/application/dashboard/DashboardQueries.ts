import type { DashboardGuildListResponse, DashboardGuildResponse, DashboardKeywordListResponse, DashboardSessionResponse } from '@tsumugi/contracts';

import type { DashboardGateway, DashboardRequestContext } from './DashboardGateway.js';

export class DashboardQueries {
    public constructor(private readonly gateway: DashboardGateway) {}

    public getSession(context: DashboardRequestContext): Promise<DashboardSessionResponse> {
        return this.gateway.getSession(context);
    }

    public listGuilds(context: DashboardRequestContext): Promise<DashboardGuildListResponse> {
        return this.gateway.listGuilds(context);
    }

    public getGuild(context: DashboardRequestContext, guildId: string): Promise<DashboardGuildResponse> {
        return this.gateway.getGuild(context, guildId);
    }

    public listKeywords(context: DashboardRequestContext, guildId: string, channelId: string): Promise<DashboardKeywordListResponse> {
        return this.gateway.listKeywords(context, guildId, channelId);
    }
}
