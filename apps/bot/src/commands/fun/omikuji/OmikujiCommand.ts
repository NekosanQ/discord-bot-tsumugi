import { ChatInputCommandInteraction } from 'discord.js';

import OmikujiService from '../../../services/OmikujiService.js';
import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { CommandInteraction } from '../../base/command_base.js';
import OmikujiEmbed from './OmikujiEmbed.js';

/**
 * おみくじコマンド
 */
class OmikujiCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('omikuji')
        .setDescription('おみくじが引けます')
        .setCategory('お遊び系')
        .setCooldown(5)
        .setUsage('`/omikuji`');

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const result = OmikujiService.draw();
        const embed = OmikujiEmbed.create(interaction, result);

        await interaction.editReply({
            embeds: [embed]
        });
    }
}

export default new OmikujiCommand();
