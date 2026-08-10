import type { Clock } from '../Clock.js';
import type { CommandFailureLogger } from '../CommandFailureLogger.js';
import { formatDateTime } from '../formatDateTime.js';
import type { GuildChannelKind, GuildInformationReader, GuildInformationSnapshot, GuildRoleSnapshot } from './GuildInformationReader.js';

const MAX_ROLE_LIST_LENGTH = 1_000;

export interface GuildInformationSymbols {
    memberEmoji: string;
    botEmoji: string;
    emoji: string;
    gifEmoji: string;
    channelEmoji: {
        category: string;
        publicText: string;
        lockedText: string;
        publicVoice: string;
        lockedVoice: string;
        publicAnnouncement: string;
        lockedAnnouncement: string;
        publicStage: string;
        lockedStage: string;
    };
}

export interface GuildInformationView {
    thumbnailUrl: string | null;
    basicInformation: string;
    statistics: string;
    rolesTitle: string;
    roles: string;
}

export type GetGuildInformationResult =
    | { status: 'success'; information: GuildInformationView }
    | { status: 'guild-required' }
    | { status: 'fetch-failed' };

export class GetGuildInformation {
    public constructor(
        private readonly reader: GuildInformationReader,
        private readonly logger: CommandFailureLogger,
        private readonly clock: Clock,
        private readonly symbols: GuildInformationSymbols
    ) {}

    public async execute(guildId: string | null): Promise<GetGuildInformationResult> {
        if (!guildId) return { status: 'guild-required' };

        try {
            const snapshot = await this.reader.read(guildId);
            return { status: 'success', information: this.format(snapshot) };
        } catch (error) {
            this.logger.failure('guild-information', error);
            return { status: 'fetch-failed' };
        }
    }

    private format(snapshot: GuildInformationSnapshot): GuildInformationView {
        const basicInformation = [
            `**名前(ID)**: ${snapshot.name} (\`${snapshot.id}\`)`,
            `**所有者(ID)**: ${snapshot.ownerMention} (\`${snapshot.ownerId}\`)`,
            `**作成日時**: ${formatDateTime(snapshot.createdAt, this.clock.now())}`,
            `**説明**: ${snapshot.description ?? 'なし'}`
        ].join('\n');
        const statistics = [
            this.formatMemberStatistics(snapshot),
            this.formatBoostStatistics(snapshot),
            this.formatChannelStatistics(snapshot),
            this.formatEmojiStatistics(snapshot),
            `**スタンプ数**: ${snapshot.stickerCount.toLocaleString()}`,
            `**サウンドボード数**: ${snapshot.soundboardCount.toLocaleString()}`
        ].join('\n');

        return {
            thumbnailUrl: snapshot.iconUrl,
            basicInformation,
            statistics,
            rolesTitle: `役職 (${(snapshot.roles.length - 1).toLocaleString()})`,
            roles: this.formatRoles(snapshot.id, snapshot.roles)
        };
    }

    private formatMemberStatistics(snapshot: GuildInformationSnapshot): string {
        const memberCount = snapshot.members.filter((member) => !member.isBot).length.toLocaleString();
        const botCount = snapshot.members.filter((member) => member.isBot).length.toLocaleString();
        return `**メンバー数**: ${snapshot.memberCount.toLocaleString()} (${this.symbols.memberEmoji}: ${memberCount}, ${this.symbols.botEmoji}: ${botCount})`;
    }

    private formatBoostStatistics(snapshot: GuildInformationSnapshot): string {
        if (snapshot.premiumSubscriptionCount === 0) return '**ブースト数**: 0';
        return `**ブースト数**: ${snapshot.premiumSubscriptionCount.toLocaleString()} (Lv.${String(snapshot.premiumTier)})`;
    }

    private formatEmojiStatistics(snapshot: GuildInformationSnapshot): string {
        const staticCount = snapshot.emojis.filter((emoji) => !emoji.animated).length.toLocaleString();
        const animatedCount = snapshot.emojis.filter((emoji) => emoji.animated).length.toLocaleString();
        return `**絵文字数**: ${snapshot.emojis.length.toLocaleString()} (${this.symbols.emoji}: ${staticCount}, ${this.symbols.gifEmoji}: ${animatedCount})`;
    }

    private formatChannelStatistics(snapshot: GuildInformationSnapshot): string {
        const counts: Record<Exclude<GuildChannelKind, 'other'>, number> & { total: number } = {
            total: snapshot.channels.length,
            category: 0,
            text: 0,
            voice: 0,
            announcement: 0,
            stage: 0
        };
        const lockedCounts: Record<Exclude<GuildChannelKind, 'category' | 'other'>, number> = {
            text: 0,
            voice: 0,
            announcement: 0,
            stage: 0
        };

        for (const channel of snapshot.channels) {
            if (channel.kind === 'other') continue;
            if (channel.kind === 'category' || channel.visibleToEveryone) {
                counts[channel.kind]++;
            } else {
                lockedCounts[channel.kind]++;
            }
        }

        const details: string[] = [];
        if (counts.category > 0) details.push(`${this.symbols.channelEmoji.category} ${String(counts.category)}`);
        if (counts.text > 0) details.push(`${this.symbols.channelEmoji.publicText} ${String(counts.text)}`);
        if (lockedCounts.text > 0) details.push(`${this.symbols.channelEmoji.lockedText} ${String(lockedCounts.text)}`);
        if (counts.voice > 0) details.push(`${this.symbols.channelEmoji.publicVoice} ${String(counts.voice)}`);
        if (lockedCounts.voice > 0) details.push(`${this.symbols.channelEmoji.lockedVoice} ${String(lockedCounts.voice)}`);
        if (counts.announcement > 0) details.push(`${this.symbols.channelEmoji.publicAnnouncement} ${String(counts.announcement)}`);
        if (lockedCounts.announcement > 0) details.push(`${this.symbols.channelEmoji.lockedAnnouncement} ${String(lockedCounts.announcement)}`);
        if (counts.stage > 0) details.push(`${this.symbols.channelEmoji.publicStage} ${String(counts.stage)}`);
        if (lockedCounts.stage > 0) details.push(`${this.symbols.channelEmoji.lockedStage} ${String(lockedCounts.stage)}`);

        return `**チャンネル数**: ${counts.total.toLocaleString()} (${details.join(', ')})`;
    }

    private formatRoles(guildId: string, roles: readonly GuildRoleSnapshot[]): string {
        const sortedRoles = roles.filter((role) => role.id !== guildId).sort((left, right) => right.position - left.position);
        if (sortedRoles.length === 0) return 'なし';

        let result = '';
        for (let index = 0; index < sortedRoles.length; index++) {
            const role = sortedRoles[index];
            const separator = result.length > 0 ? ', ' : '';
            const remainingCount = sortedRoles.length - index;
            const suffix = `, ...他${String(remainingCount)}件`;
            if (result.length + separator.length + role.mention.length + suffix.length > MAX_ROLE_LIST_LENGTH) return result + suffix;
            result += separator + role.mention;
        }
        return result;
    }
}
