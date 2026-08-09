import { ChannelType, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

import { config } from '../../../utils/config.js';
import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { CommandInteraction } from '../../base/command_base.js';
/**
 * followコマンド
 */
class FollowCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('follow')
        .setDescription('Botからのお知らせをフォローして、チャンネルに通知するようにします。')
        .setCategory('一般')
        .setUsage('`/follow`')
        .setCooldown(5)
        .setDefaultBotPermissions(PermissionFlagsBits.ManageChannels)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const announcementChannel = await interaction.client.channels.fetch(config.announcementChannelId);
        if (announcementChannel?.type === ChannelType.GuildAnnouncement) {
            const channelId = interaction.channel?.id;
            if (!channelId) return;
            await announcementChannel.addFollower(channelId);
            await interaction.editReply({
                content: 'Botからのお知らせをフォローしました'
            });
        } else {
            await interaction.editReply({
                content: 'Botからのお知らせチャンネルが見つかりませんでした'
            });
        }
    }
}

export default new FollowCommand();
