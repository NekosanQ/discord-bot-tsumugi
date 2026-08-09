import { EmbedBuilder, User } from 'discord.js';

import { embeds } from '../../utils/EmbedGenerator.js';

interface PrismaKeyword {
    trigger: string;
    responses: string | string[];
}
/**
 * キーワード関連のEmbedを生成するクラス
 */
class KeywordEmbed {
    private readonly maxDescriptionLength = 2000;
    private readonly separator = ', ';

    /**
     * キーワードリストからページ分割されたEmbedの配列を生成します。
     * 文字数制限を超えた場合は、自動的に複数のEmbedに分割します。
     * @param user - Embedのフッターに表示するユーザー
     * @param keywords - 表示するキーワードの配列
     * @returns 生成されたEmbedBuilderの配列
     */
    public createPaginatedTriggerListEmbeds(user: User, keywords: PrismaKeyword[]): EmbedBuilder[] {
        if (keywords.length === 0) {
            return [embeds.info(user).setDescription('このサーバーにはキーワードが登録されていません。')];
        }

        const keywordListEmbeds: EmbedBuilder[] = [];
        let currentDescription = '';

        for (const keyword of keywords) {
            const triggerText = `\`${keyword.trigger}\``;

            if (currentDescription.length + triggerText.length + this.separator.length > this.maxDescriptionLength) {
                keywordListEmbeds.push(this.createBaseListEmbed(user, currentDescription));
                currentDescription = triggerText;
            } else {
                if (currentDescription.length > 0) {
                    currentDescription += this.separator;
                }
                currentDescription += triggerText;
            }
        }

        if (currentDescription.length > 0) {
            keywordListEmbeds.push(this.createBaseListEmbed(user, currentDescription));
        }

        keywordListEmbeds.forEach((embed, index) => {
            embed.setTitle(`キーワード一覧 (${String(index + 1)} / ${String(keywordListEmbeds.length)})`);
        });

        return keywordListEmbeds;
    }

    /**
     * 指定されたキーワードの応答メッセージ一覧Embedを生成します。
     * @param user - Embedのフッターに表示するユーザー
     * @param keyword - 表示するキーワードオブジェクト
     * @returns 生成されたEmbedBuilder
     */
    public createKeywordResponsesEmbed(user: User, keyword: PrismaKeyword): EmbedBuilder {
        const responses = Array.isArray(keyword.responses) ? keyword.responses : [keyword.responses];
        const description = responses.map((res) => `- ${res}`).join('\n');

        const embed = embeds.info(user).setTitle(`キーワード「${keyword.trigger}」の応答一覧`).setDescription(description);

        return embed;
    }

    /**
     * キーワード一覧のEmbedの基礎部分を生成するヘルパーメソッド
     * @param user - Embedのフッターに表示するユーザー
     * @param description - Embedに設定する説明文
     * @returns 生成されたEmbedBuilder
     */
    private createBaseListEmbed(user: User, description: string): EmbedBuilder {
        return embeds.info(user).setDescription(description).setFields({
            name: 'キーワードの応答確認方法',
            value: '各キーワードの応答を確認するには `/keyword list keyword: <キーワード>` を使用してください。'
        });
    }
}

export default new KeywordEmbed();
