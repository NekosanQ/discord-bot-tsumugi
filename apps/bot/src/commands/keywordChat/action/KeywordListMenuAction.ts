import { PrismaClient } from '@prisma/client';
import { ComponentType, MessageFlags, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';

import { embeds } from '../../../utils/EmbedGenerator.js';
import { MessageComponentActionInteraction } from '../../base/action_base.js';
import keywordEmbed from '../KeywordEmbed.js';

/**
 * キーワード一覧のページネーションメニューの作成と処理を行う
 */
export class KeywordListMenuAction extends MessageComponentActionInteraction<ComponentType.StringSelect> {
    public constructor(private readonly prisma: PrismaClient) {
        super('keyword_list_page', ComponentType.StringSelect);
    }

    /**
     * ページネーション用のセレクトメニュービルダーを作成します
     * @param totalPages - 総ページ数
     * @returns 作成したビルダー
     */
    public override async create(totalPages: number): Promise<StringSelectMenuBuilder> {
        const customId = this.createCustomId();

        const pageOptions = Array.from({ length: totalPages }, (_, i) => ({
            label: `${String(i + 1)}ページ目を表示`,
            value: String(i)
        }));

        const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('ページを選択').addOptions(pageOptions);
        return Promise.resolve(menu);
    }

    /**
     * メニューが選択された際の処理
     * @param interaction - 受信したインタラクション
     */
    protected override async onCommand(interaction: StringSelectMenuInteraction): Promise<void> {
        const selectedPageIndex = parseInt(interaction.values[0], 10);
        const channelId = interaction.channel?.id;
        if (!channelId) {
            const embed = embeds.error(interaction.user, 'チャンネル情報が取得できませんでした。');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const prismaKeywordsRaw = await this.prisma.keyword.findMany({
            where: { channelId: channelId },
            orderBy: { trigger: 'asc' }
        });

        const prismaKeywords = prismaKeywordsRaw.map((k) => {
            let response: string | string[] = [];

            if (k.responses) {
                response = [];
            } else if (Array.isArray(k.responses)) {
                response = k.responses.filter((v): v is string => typeof v === 'string');
            } else if (typeof k.responses === 'string') {
                response = k.responses;
            } else {
                response = [];
            }

            return {
                ...k,
                responses: response
            };
        });

        const keywordListEmbeds = keywordEmbed.createPaginatedTriggerListEmbeds(interaction.user, prismaKeywords);

        if (!Number.isInteger(selectedPageIndex) || selectedPageIndex < 0 || selectedPageIndex >= keywordListEmbeds.length) {
            const embed = embeds.error(interaction.user, '指定されたページの表示に失敗しました。');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }
        const targetEmbed = keywordListEmbeds[selectedPageIndex];

        await interaction.update({ embeds: [targetEmbed] });
    }
}
