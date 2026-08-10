import { EmbedBuilder } from 'discord.js';

import type { GetUserInformationResult } from '../../../../application/general/user/GetUserInformation.js';
import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';
import { DiscordEmbedFactory } from '../../presentation/DiscordEmbedFactory.js';

export class UserPresenter {
    public constructor(private readonly embeds: DiscordEmbedFactory) {}

    public present(user: DiscordEmbedUser, result: GetUserInformationResult): EmbedBuilder {
        if (result.status === 'guild-required') {
            return this.embeds.error(user, 'このコマンドはサーバー内でのみ使用できます。');
        }
        if (result.status === 'member-fetch-failed') {
            return this.embeds.error(user, 'メンバーの取得に失敗しました。');
        }

        const information = result.information;
        return this.embeds
            .info(user)
            .setTitle(information.title)
            .setFields(
                { name: '基本情報', value: information.basicInformation },
                { name: 'メンバー情報', value: information.memberInformation },
                { name: information.rolesTitle, value: information.roles },
                { name: information.permissionsTitle, value: information.permissions }
            )
            .setThumbnail(information.thumbnailUrl);
    }
}
