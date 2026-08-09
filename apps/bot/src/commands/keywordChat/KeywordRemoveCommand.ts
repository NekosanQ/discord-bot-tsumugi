import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

import type { KeywordManagement } from '../../application/keyword/KeywordManagement.js';
import { KeywordApiError } from '../../infrastructure/api-client/keyword/HttpKeywordManagementClient.js';
import CustomSlashSubcommandBuilder from '../../utils/CustomSlashSubCommandBuilder.js';
import { logger } from '../../utils/log.js';
import { CommandGroupInteraction, SubCommandInteraction } from '../base/command_base.js';

/**
 * キーワード削除コマンド
 */
export class KeywordRemoveCommand extends SubCommandInteraction {
    public command = new CustomSlashSubcommandBuilder()
        .setName('remove')
        .setDescription('登録されているキーワードを削除します。')
        .setCategory('キーワード応答機能')
        .setUsage('`/keyword remove <キーワード>`')
        .addStringOption((option) =>
            option.setName('keyword').setDescription('削除するキーワードを指定します。').setRequired(true)
        ) as CustomSlashSubcommandBuilder;

    public constructor(
        registry: CommandGroupInteraction,
        private readonly keywordManagement: KeywordManagement
    ) {
        super(registry);
    }

    /** @inheritdoc */
    public async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const trigger = interaction.options.getString('keyword', true);

        try {
            const channelId = interaction.channel?.id;
            const guildId = interaction.guildId;
            if (!channelId || !guildId) {
                await interaction.reply({ content: 'チャンネル情報が取得できませんでした。', flags: MessageFlags.Ephemeral });
                return;
            }
            await this.keywordManagement.remove({ guildId, channelId }, trigger);
            await interaction.reply({ content: `キーワード「${trigger}」を削除しました。`, flags: MessageFlags.Ephemeral });
        } catch (error) {
            const message =
                error instanceof KeywordApiError && error.code === 'not_found'
                    ? `キーワード「${trigger}」は見つかりませんでした。`
                    : 'キーワードの削除中にエラーが発生しました。';
            await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
            logger.error('キーワード削除処理中にエラーが発生', error);
        }
    }
}
