import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

import { CommandInteraction } from '../../../../commands/base/command_base.js';
import CustomSlashCommandBuilder from '../../../../utils/CustomSlashCommandBuilder.js';
import { FollowController } from './FollowController.js';

/** Discord入力をお知らせfollow controllerへ変換する。 */
export class FollowCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('follow')
        .setDescription('Botからのお知らせをフォローして、チャンネルに通知するようにします。')
        .setCategory('一般')
        .setUsage('`/follow`')
        .setCooldown(5)
        .setDefaultBotPermissions(PermissionFlagsBits.ManageChannels)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

    public constructor(private readonly controller: FollowController) {
        super();
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        await this.controller.execute({
            destinationChannelId: interaction.channel?.id,
            editReply: async (content): Promise<void> => {
                await interaction.editReply({ content });
            }
        });
    }
}
