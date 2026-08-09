import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { config } from '../../../utils/config.js';
/**
 * Botコマンドのコンポーネントを作成する
 */
class BotComponents {
    /**
     * アクションボタンの行を作成する
     * @returns 作成されたActionRowBuilder
     */
    public createActionRow(): ActionRowBuilder<ButtonBuilder> {
        const buttons = [
            new ButtonBuilder().setLabel('Botを導入').setStyle(ButtonStyle.Link).setURL(config.inviteURL),
            new ButtonBuilder().setLabel('サポートサーバーに参加').setStyle(ButtonStyle.Link).setURL(config.supportGuildURL)
        ];
        return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    }
}
export default new BotComponents();
