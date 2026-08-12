import type { DashboardGuildListResponse, DashboardGuildResponse, DashboardKeywordListResponse, DashboardSessionResponse } from '@tsumugi/contracts';

export interface DashboardGateway {
    getSession: (context: DashboardRequestContext) => Promise<DashboardSessionResponse>;
    listGuilds: (context: DashboardRequestContext) => Promise<DashboardGuildListResponse>;
    getGuild: (context: DashboardRequestContext, guildId: string) => Promise<DashboardGuildResponse>;
    listKeywords: (context: DashboardRequestContext, guildId: string, channelId: string) => Promise<DashboardKeywordListResponse>;
}

export interface DashboardRequestContext {
    cookieHeader: string;
    clientId: string;
}
