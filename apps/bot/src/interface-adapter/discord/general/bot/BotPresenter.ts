import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, time, TimestampStyles } from 'discord.js';

import type { BotInformation } from '../../../../application/general/bot/GetBotInformation.js';
import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';
import { DiscordEmbedFactory } from '../../presentation/DiscordEmbedFactory.js';

export interface BotPresentationOptions {
    iconUrl: string;
    inviteUrl: string;
    supportGuildUrl: string;
}

export interface BotPresentation {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>;
}

export class BotPresenter {
    public constructor(
        private readonly embeds: DiscordEmbedFactory,
        private readonly options: BotPresentationOptions
    ) {}

    public present(user: DiscordEmbedUser, information: BotInformation): BotPresentation {
        const embed = this.embeds
            .info(user)
            .setAuthor({ name: `${information.username}の情報`, iconURL: this.options.iconUrl })
            .setThumbnail(this.options.iconUrl)
            .addFields(
                { name: '名前', value: `${information.username} (Tsumugi Byousaki)`, inline: false },
                { name: '作成日', value: time(information.createdAt, TimestampStyles.RelativeTime), inline: true },
                { name: 'バージョン', value: information.version, inline: true },
                { name: '導入サーバー数', value: information.guildCount, inline: true },
                { name: '総ユーザー数', value: information.userCount, inline: true }
            );
        const components = new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder().setLabel('Botを導入').setStyle(ButtonStyle.Link).setURL(this.options.inviteUrl),
            new ButtonBuilder().setLabel('サポートサーバーに参加').setStyle(ButtonStyle.Link).setURL(this.options.supportGuildUrl)
        ]);
        return { embed, components };
    }
}
