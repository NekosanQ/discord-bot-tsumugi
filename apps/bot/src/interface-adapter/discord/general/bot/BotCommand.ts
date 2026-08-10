import { ChatInputCommandInteraction } from 'discord.js';

import { CommandInteraction } from '../../../../commands/base/command_base.js';
import CustomSlashCommandBuilder from '../../../../utils/CustomSlashCommandBuilder.js';
import { BotController } from './BotController.js';

/** Discord入力をBot情報controllerへ変換する。 */
export class BotCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('bot')
        .setDescription('Botの情報を表示します')
        .setCategory('一般')
        .setCooldown(5)
        .setUsage('`/bot`');

    public constructor(private readonly controller: BotController) {
        super();
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        await this.controller.execute({
            user: interaction.user,
            editReply: async (embed, components): Promise<void> => {
                await interaction.editReply({ embeds: [embed], components: [components] });
            }
        });
    }
}
