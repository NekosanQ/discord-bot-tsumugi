import { ChatInputCommandInteraction } from 'discord.js';

import BotInfoService from '../../../services/BotInfoService.js';
import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { logger } from '../../../utils/log.js';
import { CommandInteraction } from '../../base/command_base.js';
import BotComponents from './BotComponents.js';
import BotEmbed from './BotEmbed.js';

/**
 * Botコマンド
 */
class BotCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('bot')
        .setDescription('Botの情報を表示します')
        .setCategory('一般')
        .setCooldown(5)
        .setUsage('`/bot`');

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const botInfo = BotInfoService.getBotInfo(interaction.client);

            const embed = BotEmbed.create(interaction, botInfo);
            const components = BotComponents.createActionRow();

            await interaction.editReply({
                embeds: [embed],
                components: [components]
            });
        } catch (error) {
            logger.error('Botコマンドの実行中にエラーが発生しました: ', error);
        }
    }
}

export default new BotCommand();
