import { Guild, TextChannel } from 'discord.js';

import { config } from '../utils/config.js';
import { dateTimeFormatter } from '../utils/dateTimeFormatter.js';
import { embeds } from '../utils/EmbedGenerator.js';
import { logger } from '../utils/log.js';
import { EventBase } from './base/event_base.js';

export class GuildCreateEvent extends EventBase<'guildCreate'> {
    public eventName = 'guildCreate' as const;

    public async listener(guild: Guild): Promise<void> {
        try {
            let ownerName = '不明';
            let ownerId = '不明';
            try {
                const owner = await guild.fetchOwner();
                ownerName = owner.user.username;
                ownerId = owner.user.id;
            } catch (error) {
                logger.warn('所有権者の取得に失敗', error);
            }

            const description = guild.description ?? 'なし';

            const basicInfo = [
                `**名前(ID)**: ${guild.name} (\`${guild.id}\`)`,
                `**所有者(ID)**: ${ownerName} (\`${ownerId}\`)`,
                `**作成日時**: ${dateTimeFormatter(guild.createdAt)}`,
                `**メンバー数**: ${guild.memberCount.toLocaleString()}人`,
                `**説明**: \n${description}`
            ].join('\n');

            const guildAddCount = `${guild.client.guilds.cache.size.toLocaleString()} サーバー`;

            const embed = embeds
                .system()
                .setTitle('BOT導入通知')
                .setFields({ name: '📊 基本情報', value: basicInfo }, { name: '📈 導入サーバー数', value: guildAddCount })
                .setThumbnail(guild.iconURL() ?? null);

            const channel = await guild.client.channels.fetch(config.botEntranceChannelId);

            if (channel && (channel instanceof TextChannel || channel.isThread())) {
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            logger.error('GuildCreateEventでエラーが発生', error);
        }
    }
}
