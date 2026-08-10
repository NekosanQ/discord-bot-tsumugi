import { EmbedBuilder } from 'discord.js';

import type { GetGuildInformationResult } from '../../../../application/general/guild/GetGuildInformation.js';
import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';
import { DiscordEmbedFactory } from '../../presentation/DiscordEmbedFactory.js';

export class GuildPresenter {
    public constructor(private readonly embeds: DiscordEmbedFactory) {}

    public present(user: DiscordEmbedUser, result: GetGuildInformationResult): EmbedBuilder {
        if (result.status === 'guild-required') {
            return this.embeds.error(user, 'サーバー情報の取得に失敗しました。');
        }
        if (result.status === 'fetch-failed') {
            return this.embeds.error(user, 'サーバー情報の取得中にエラーが発生しました。');
        }

        const information = result.information;
        return this.embeds
            .info(user)
            .setTitle('サーバー情報')
            .setThumbnail(information.thumbnailUrl)
            .setFields(
                { name: '基本情報', value: information.basicInformation, inline: true },
                { name: '統計情報', value: information.statistics, inline: true },
                { name: information.rolesTitle, value: information.roles }
            );
    }
}
