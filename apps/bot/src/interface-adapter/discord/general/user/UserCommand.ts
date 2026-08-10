import { ChatInputCommandInteraction } from 'discord.js';

import { CommandInteraction } from '../../../../commands/base/command_base.js';
import CustomSlashCommandBuilder from '../../../../utils/CustomSlashCommandBuilder.js';
import { UserController } from './UserController.js';

/** Discordのuser optionをapplication用IDへ変換する。 */
export class UserCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('user')
        .setDescription('ユーザー情報を表示します')
        .setCategory('一般')
        .setCooldown(10)
        .setUsage('`/user [user]`')
        .addUserOption((option) => option.setName('user').setDescription('ユーザーオブジェクト').setRequired(false)) as CustomSlashCommandBuilder;

    public constructor(private readonly controller: UserController) {
        super();
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        await this.controller.execute({
            user: interaction.user,
            guildId: interaction.guildId,
            targetUserId: interaction.options.getUser('user')?.id ?? interaction.user.id,
            editReply: async (embed): Promise<void> => {
                await interaction.editReply({ embeds: [embed] });
            }
        });
    }
}
