import {
    ChannelType,
    ChatInputCommandInteraction,
    Collection,
    EmbedBuilder,
    Emoji,
    Guild,
    GuildMember,
    NonThreadGuildBasedChannel,
    Role
} from 'discord.js';

import { config } from '../../../utils/config.js';
import { dateTimeFormatter } from '../../../utils/dateTimeFormatter.js';
import { embeds } from '../../../utils/EmbedGenerator.js';
import { logger } from '../../../utils/log.js';

class GuildEmbed {
    private static readonly maxRoleLength = 1000;

    /**
     * サーバー情報Embedを生成して返します
     */
    public async create(interaction: ChatInputCommandInteraction): Promise<EmbedBuilder> {
        if (!interaction.guildId) {
            return embeds.error(interaction.user, 'サーバー情報の取得に失敗しました。');
        }

        try {
            const guild = await interaction.client.guilds.fetch(interaction.guildId);

            const [channels, members, roles, emojis, stickers, soundboardSounds] = await Promise.all([
                guild.channels.fetch(),
                guild.members.fetch(),
                guild.roles.fetch(),
                guild.emojis.fetch(),
                guild.stickers.fetch(),
                guild.soundboardSounds.fetch()
            ]);

            const owner = await guild.fetchOwner();
            const basicInfo = [
                `**名前(ID)**: ${guild.name} (\`${guild.id}\`)`,
                `**所有者(ID)**: ${owner.toString()} (\`${owner.id}\`)`,
                `**作成日時**: ${dateTimeFormatter(guild.createdAt)}`,
                `**説明**: ${guild.description ?? 'なし'}`
            ].join('\n');

            const statsInfo = [
                this.getMemberStats(guild, members),
                this.getBoostStats(guild),
                this.getChannelStats(guild, channels),
                this.getEmojiStats(emojis),
                `**スタンプ数**: ${stickers.size.toLocaleString()}`,
                `**サウンドボード数**: ${soundboardSounds.size.toLocaleString()}`
            ].join('\n');

            const rolesString = this.formatRoleList(guild, roles);

            return embeds
                .info(interaction.user)
                .setTitle('サーバー情報')
                .setThumbnail(guild.iconURL())
                .setFields(
                    { name: '基本情報', value: basicInfo, inline: true },
                    { name: '統計情報', value: statsInfo, inline: true },
                    { name: `役職 (${(roles.size - 1).toLocaleString()})`, value: rolesString } // @everyoneを除くため -1
                );
        } catch (error) {
            logger.error('サーバー情報の取得中にエラーが発生しました:', error);
            return embeds.error(interaction.user, 'サーバー情報の取得中にエラーが発生しました。');
        }
    }

    /**
     * メンバー統計文字列を生成
     */
    private getMemberStats(guild: Guild, members: Collection<string, GuildMember>): string {
        const memberCount = members.filter((m) => !m.user.bot).size.toLocaleString();
        const botCount = members.filter((m) => m.user.bot).size.toLocaleString();
        const total = guild.memberCount.toLocaleString();

        return `**メンバー数**: ${total} (${config.memberEmoji}: ${memberCount}, ${config.botEmoji}: ${botCount})`;
    }

    /**
     * ブースト統計文字列を生成
     */
    private getBoostStats(guild: Guild): string {
        const count = guild.premiumSubscriptionCount ?? 0;
        if (count === 0) return '**ブースト数**: 0';
        return `**ブースト数**: ${count.toLocaleString()} (Lv.${String(guild.premiumTier)})`;
    }

    /**
     * 絵文字統計文字列を生成
     */
    private getEmojiStats(emojis: Collection<string, Emoji>): string {
        const total = emojis.size.toLocaleString();
        const staticCount = emojis.filter((e) => !e.animated).size.toLocaleString();
        const animatedCount = emojis.filter((e) => e.animated).size.toLocaleString();

        return `**絵文字数**: ${total} (${config.emoji}: ${staticCount}, ${config.gifEmoji}: ${animatedCount})`;
    }

    /**
     * チャンネル統計文字列を生成
     */
    private getChannelStats(guild: Guild, channels: Collection<string, NonThreadGuildBasedChannel | null>): string {
        const counts = {
            total: 0,
            category: 0,
            publicText: 0,
            lockedText: 0,
            publicVoice: 0,
            lockedVoice: 0,
            publicAnnouncement: 0,
            lockedAnnouncement: 0,
            publicStage: 0,
            lockedStage: 0
        };

        const everyoneRole = guild.roles.everyone;

        channels.forEach((channel) => {
            if (!channel) return;
            counts.total++;

            if (channel.type === ChannelType.GuildCategory) {
                counts.category++;
                return;
            }

            const isPublic = channel.permissionsFor(everyoneRole).has('ViewChannel');

            switch (channel.type) {
                case ChannelType.GuildText:
                    if (isPublic) {
                        counts.publicText++;
                    } else {
                        counts.lockedText++;
                    }
                    break;
                case ChannelType.GuildVoice:
                    if (isPublic) {
                        counts.publicVoice++;
                    } else {
                        counts.lockedVoice++;
                    }
                    break;
                case ChannelType.GuildAnnouncement:
                    if (isPublic) {
                        counts.publicAnnouncement++;
                    } else {
                        counts.lockedAnnouncement++;
                    }
                    break;
                case ChannelType.GuildStageVoice:
                    if (isPublic) {
                        counts.publicStage++;
                    } else {
                        counts.lockedStage++;
                    }
                    break;
            }
        });

        const emoji = config.channelEmoji;
        const details: string[] = [];

        if (counts.category > 0) details.push(`${emoji.category} ${String(counts.category)}`);
        if (counts.publicText > 0) details.push(`${emoji.publicText} ${String(counts.publicText)}`);
        if (counts.lockedText > 0) details.push(`${emoji.lockedText} ${String(counts.lockedText)}`);
        if (counts.publicVoice > 0) details.push(`${emoji.publicVoice} ${String(counts.publicVoice)}`);
        if (counts.lockedVoice > 0) details.push(`${emoji.lockedVoice} ${String(counts.lockedVoice)}`);
        if (counts.publicAnnouncement > 0) details.push(`${emoji.publicAnnouncement} ${String(counts.publicAnnouncement)}`);
        if (counts.lockedAnnouncement > 0) details.push(`${emoji.lockedAnnouncement} ${String(counts.lockedAnnouncement)}`);
        if (counts.publicStage > 0) details.push(`${emoji.publicStage} ${String(counts.publicStage)}`);
        if (counts.lockedStage > 0) details.push(`${emoji.lockedStage} ${String(counts.lockedStage)}`);

        return `**チャンネル数**: ${counts.total.toLocaleString()} (${details.join(', ')})`;
    }

    /**
     * 役職リストを整形
     */
    private formatRoleList(guild: Guild, roles: Collection<string, Role>): string {
        const sortedRoles = roles.filter((role) => role.id !== guild.id).sort((a, b) => b.position - a.position);

        if (sortedRoles.size === 0) return 'なし';

        let result = '';
        const roleArray = [...sortedRoles.values()];

        for (let i = 0; i < roleArray.length; i++) {
            const roleMention = roleArray[i].toString();
            const separator = result.length > 0 ? ', ' : '';

            const remainingCount = roleArray.length - i;
            const suffix = `, ...他${String(remainingCount)}件`;

            if (result.length + separator.length + roleMention.length + suffix.length > GuildEmbed.maxRoleLength) {
                result += suffix;
                return result;
            }

            result += separator + roleMention;
        }

        return result;
    }
}

export default new GuildEmbed();
