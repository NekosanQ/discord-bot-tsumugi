import { ChatInputCommandInteraction } from 'discord.js';

import { CommandInteraction } from '../../../../commands/base/command_base.js';
import CustomSlashCommandBuilder from '../../../../utils/CustomSlashCommandBuilder.js';
import { GuildController } from './GuildController.js';

/** Discordのguild IDをサーバー情報controllerへ渡す。 */
export class GuildCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('guild')
        .setDescription('サーバー情報を表示します')
        .setCategory('一般')
        .setCooldown(10)
        .setUsage('`/guild`');

    public constructor(private readonly controller: GuildController) {
        super();
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        await this.controller.execute({
            user: interaction.user,
            guildId: interaction.guildId,
            editReply: async (embed): Promise<void> => {
                await interaction.editReply({ embeds: [embed] });
            }
        });
    }
}
