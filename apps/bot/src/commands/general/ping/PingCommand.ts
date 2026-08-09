import { ChatInputCommandInteraction, Message } from 'discord.js';

import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { CommandInteraction } from '../../base/command_base.js';
import PingEmbed from './PingEmbed.js';

/**
 * Pingコマンド
 */
class PingCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('ping')
        .setDescription('Pingを表示します')
        .setCooldown(5)
        .setCategory('一般')
        .setUsage('`/ping`');

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const pingingEmbed = PingEmbed.createPingingEmbed(interaction);
        await interaction.editReply({
            embeds: [pingingEmbed]
        });

        const message: Message = await interaction.fetchReply();

        const updatedPingEmbed = PingEmbed.createResultEmbed(interaction, message);
        await interaction.editReply({
            embeds: [updatedPingEmbed]
        });
    }
}

export default new PingCommand();
