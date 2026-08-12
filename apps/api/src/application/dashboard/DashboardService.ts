import type { DashboardChannelDto, DashboardGuildDto, DashboardGuildResponse, DashboardKeywordListResponse, KeywordDto } from '@tsumugi/contracts';

import { DashboardAuthorizationError, ManagedDashboardResourceError } from '../../domain/dashboard/DashboardErrors.js';
import {
    canManageGuild,
    discordGuildIconUrl,
    type DiscordGuildMembership,
    type ManagedChannelSnapshot
} from '../../domain/dashboard/DashboardTypes.js';
import { createKeyword } from '../../domain/keyword/Keyword.js';
import { KeywordNotFoundError } from '../keyword/KeywordApplicationErrors.js';
import type { KeywordLookupCache } from '../keyword/KeywordLookupCache.js';
import type { KeywordScope } from '../keyword/KeywordRepository.js';
import type { DashboardAuthService } from './DashboardAuthService.js';
import type { DashboardKeywordRepository, DashboardProjectionRepository, DiscordOAuthGateway } from './DashboardPorts.js';

function toKeywordDto(keyword: { guildId: string; channelId: string; trigger: string; responses: readonly string[] }): KeywordDto {
    return { ...keyword, responses: [...keyword.responses] };
}

function toChannelDto(channel: ManagedChannelSnapshot): DashboardChannelDto {
    return { id: channel.id, name: channel.name, type: channel.type };
}

export class DashboardService {
    private readonly reportCacheError: (error: unknown) => void;

    public constructor(
        private readonly auth: Pick<DashboardAuthService, 'authenticate'>,
        private readonly discord: DiscordOAuthGateway,
        private readonly projection: DashboardProjectionRepository,
        private readonly keywords: DashboardKeywordRepository,
        private readonly keywordCache?: KeywordLookupCache,
        reportCacheError: (error: unknown) => void = (): void => undefined
    ) {
        this.reportCacheError = reportCacheError;
    }

    public async listGuilds(sessionId: string | undefined): Promise<DashboardGuildDto[]> {
        const session = await this.auth.authenticate(sessionId);
        const memberships = (await this.discord.listCurrentUserGuilds(session.accessToken)).filter(canManageGuild);
        const installations = await this.projection.findGuilds(memberships.map((guild) => guild.id));
        const installedById = new Map(installations.map((guild) => [guild.id, guild.botInstalled]));
        return memberships.map((guild): DashboardGuildDto => this.toGuildDto(guild, installedById.get(guild.id) ?? false));
    }

    public async getGuild(sessionId: string | undefined, guildId: string): Promise<DashboardGuildResponse> {
        const { membership } = await this.requireManagedGuild(sessionId, guildId);
        const channels = await this.projection.listAvailableChannels(guildId);
        if (!channels) throw new ManagedDashboardResourceError();
        return { guild: this.toGuildDto(membership, true), channels: channels.map(toChannelDto) };
    }

    public async listKeywords(sessionId: string | undefined, guildId: string, channelId: string): Promise<DashboardKeywordListResponse> {
        await this.requireManagedGuild(sessionId, guildId);
        return { keywords: (await this.keywords.list({ guildId, channelId })).map(toKeywordDto) };
    }

    public async saveKeyword(
        sessionId: string | undefined,
        guildId: string,
        channelId: string,
        trigger: string,
        responses: readonly string[],
        correlationId: string
    ): Promise<KeywordDto> {
        const { userId } = await this.requireManagedGuild(sessionId, guildId);
        const keyword = createKeyword({ guildId, channelId, trigger, responses });
        await this.keywords.saveWithAudit(keyword, userId, correlationId);
        await this.invalidateKeywordCache({ guildId: keyword.guildId, channelId: keyword.channelId });
        return toKeywordDto(keyword);
    }

    public async removeKeyword(
        sessionId: string | undefined,
        guildId: string,
        channelId: string,
        trigger: string,
        correlationId: string
    ): Promise<void> {
        const { userId } = await this.requireManagedGuild(sessionId, guildId);
        const removed = await this.keywords.removeWithAudit({ guildId, channelId }, trigger, userId, correlationId);
        if (!removed) throw new KeywordNotFoundError(trigger);
        await this.invalidateKeywordCache({ guildId, channelId });
    }

    private async requireManagedGuild(
        sessionId: string | undefined,
        guildId: string
    ): Promise<{ membership: DiscordGuildMembership; userId: string }> {
        const session = await this.auth.authenticate(sessionId);
        const membership = (await this.discord.listCurrentUserGuilds(session.accessToken)).find((guild) => guild.id === guildId);
        if (!membership || !canManageGuild(membership)) throw new DashboardAuthorizationError();
        const installation = (await this.projection.findGuilds([guildId])).find((guild) => guild.id === guildId);
        if (!installation?.botInstalled) throw new ManagedDashboardResourceError('Botが導入済みのサーバーではありません。');
        return { membership, userId: session.user.id };
    }

    private toGuildDto(guild: DiscordGuildMembership, botInstalled: boolean): DashboardGuildDto {
        return { id: guild.id, name: guild.name, iconUrl: discordGuildIconUrl(guild), botInstalled };
    }

    private async invalidateKeywordCache(scope: KeywordScope): Promise<void> {
        if (!this.keywordCache) return;
        try {
            await this.keywordCache.invalidate(scope);
        } catch (error) {
            this.reportCacheError(error);
        }
    }
}
