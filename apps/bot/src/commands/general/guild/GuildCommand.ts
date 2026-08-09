import { ChatInputCommandInteraction } from 'discord.js';

import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { CommandInteraction } from '../../base/command_base.js';
import guildEmbed from './GuildEmbed.js';

class GuildCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('guild')
        .setDescription('サーバー情報を表示します')
        .setCategory('一般')
        .setCooldown(10)
        .setUsage('`/guild`');

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const embed = await guildEmbed.create(interaction);
        await interaction.editReply({ embeds: [embed] });
    }
}

export default new GuildCommand();
