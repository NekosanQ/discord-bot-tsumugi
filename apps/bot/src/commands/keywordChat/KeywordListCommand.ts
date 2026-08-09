import { ActionRowBuilder, ChatInputCommandInteraction, StringSelectMenuBuilder } from 'discord.js';

import type { KeywordManagement } from '../../application/keyword/KeywordManagement.js';
import { KeywordApiError } from '../../infrastructure/api-client/keyword/HttpKeywordManagementClient.js';
import CustomSlashSubcommandBuilder from '../../utils/CustomSlashSubCommandBuilder.js';
import { CommandGroupInteraction, SubCommandInteraction } from '../base/command_base.js';
import { KeywordListMenuAction } from './action/KeywordListMenuAction.js';
import keywordEmbed from './KeywordEmbed.js';
/**
 * キーワード一覧表示コマンド
 */
export class KeywordListCommand extends SubCommandInteraction {
    public command = new CustomSlashSubcommandBuilder()
        .setName('list')
        .setDescription('登録されているキーワードの一覧、または指定したキーワードの応答を表示します。')
        .setCategory('キーワード応答機能')
        .setUsage('`/keyword list`\n`/keyword list keyword: <キーワード名>`')
        .addStringOption((option) =>
            option.setName('keyword').setDescription('応答を表示するキーワードを指定します。').setRequired(false)
        ) as CustomSlashSubcommandBuilder;

    public constructor(
        registry: CommandGroupInteraction,
        private readonly keywordManagement: KeywordManagement,
        private readonly keywordListMenuAction: KeywordListMenuAction
    ) {
        super(registry);
    }

    /** @inheritdoc */
    public async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const triggerKeyword = interaction.options.getString('keyword');

        if (triggerKeyword) {
            await this.showResponses(interaction, triggerKeyword);
        } else {
            await this.showList(interaction);
        }
    }

    /**
     * 登録されているキーワードの一覧を表示する
     * 複数ページになる場合はページネーションメニューを付ける
     */
    private async showList(interaction: ChatInputCommandInteraction): Promise<void> {
        const channelId = interaction.channel?.id;
        const guildId = interaction.guildId;
        if (!channelId || !guildId) {
            await interaction.editReply('チャンネル情報が取得できませんでした。');
            return;
        }
        const keywords = await this.keywordManagement.list({ guildId, channelId });

        if (keywords.length === 0) {
            await interaction.editReply('このチャンネルには登録されているキーワードがありません。');
            return;
        }
        // ページ分割されたEmbedの配列を生成
        const embeds = keywordEmbed.createPaginatedTriggerListEmbeds(interaction.user, keywords);
        const firstEmbed = embeds[0];

        if (embeds.length <= 1) {
            await interaction.editReply({ embeds: [firstEmbed], components: [] });
            return;
        }

        const menu = await this.keywordListMenuAction.create(embeds.length);
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

        await interaction.editReply({
            embeds: [firstEmbed],
            components: [row]
        });
    }

    /**
     * 指定されたキーワードの応答メッセージを表示します。
     */
    private async showResponses(interaction: ChatInputCommandInteraction, trigger: string): Promise<void> {
        const channelId = interaction.channel?.id;
        const guildId = interaction.guildId;
        if (!channelId || !guildId) {
            await interaction.editReply('チャンネル情報が取得できませんでした。');
            return;
        }
        let keyword;
        try {
            keyword = await this.keywordManagement.get({ guildId, channelId }, trigger);
        } catch (error) {
            if (error instanceof KeywordApiError && error.code === 'not_found') {
                keyword = undefined;
            } else {
                throw error;
            }
        }

        if (!keyword) {
            await interaction.editReply(`キーワード「${trigger}」は見つかりませんでした。`);
            return;
        }

        const embed = keywordEmbed.createKeywordResponsesEmbed(interaction.user, keyword);
        await interaction.editReply({ embeds: [embed] });
    }
}
