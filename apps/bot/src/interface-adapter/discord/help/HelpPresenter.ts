import { EmbedBuilder } from 'discord.js';

import type { CommandCategory, CommandHelpEntry } from '../../../application/help/CommandCatalog.js';
import { PermissionTranslator } from '../../../utils/PermissionTranslator.js';
import type { DiscordEmbedUser } from '../presentation/DiscordEmbedFactory.js';
import { DiscordEmbedFactory } from '../presentation/DiscordEmbedFactory.js';

export interface HelpPresentationOptions {
    iconUrl: string;
    inviteUrl: string;
    supportGuildUrl: string;
}

const translatePermission = (bitfield: bigint): string[] => new PermissionTranslator(bitfield).permissionNames;

export class HelpPresenter {
    public constructor(
        private readonly embeds: DiscordEmbedFactory,
        private readonly options: HelpPresentationOptions
    ) {}

    public home(user: DiscordEmbedUser, categories: readonly CommandCategory[]): EmbedBuilder {
        const categoryPages =
            categories.length > 0
                ? categories.map((category, index) => `${String(index + 1)}ページ目: ${category.category}`).join('\n')
                : '利用可能なコマンドカテゴリはありません。';

        return this.embeds
            .info(user)
            .setAuthor({ name: '猫咲 紬 - ヘルプ', iconURL: this.options.iconUrl })
            .setDescription('コマンドの詳細は`/help [コマンド名]`で表示できます。')
            .addFields(
                { name: '各カテゴリー', value: categoryPages },
                {
                    name: 'Botを招待/サポートサーバー',
                    value: `[Botを招待する](${this.options.inviteUrl}) / [サポートサーバーに入る](${this.options.supportGuildUrl})`
                }
            );
    }

    public command(user: DiscordEmbedUser, command: CommandHelpEntry, memberHasPermissions: boolean, botHasPermissions: boolean): EmbedBuilder {
        const memberPermissionList = translatePermission(command.defaultMemberPermissions).join('\n') || 'なし';
        const botPermissionList = translatePermission(command.defaultBotPermissions).join('\n') || 'なし';

        return this.embeds
            .info(user)
            .setAuthor({ name: `猫咲 紬 - コマンド詳細 [${command.name}]`, iconURL: this.options.iconUrl })
            .setDescription(command.description)
            .addFields(
                { name: 'カテゴリー', value: command.displayCategory ?? '未分類' },
                { name: '使用方法', value: command.usage ?? '使用方法が設定されていません' },
                { name: 'クールダウン', value: command.cooldownSeconds === undefined ? 'なし' : `${String(command.cooldownSeconds)}秒` },
                { name: '実行可能か', value: memberHasPermissions && botHasPermissions ? 'はい' : 'いいえ', inline: true },
                { name: 'ユーザーに必要な権限', value: memberPermissionList, inline: true },
                { name: 'Botに必要な権限', value: botPermissionList, inline: true }
            );
    }

    public category(user: DiscordEmbedUser, category: CommandCategory): EmbedBuilder {
        return this.embeds
            .info(user)
            .setAuthor({ name: `猫咲 紬 - ${category.category}`, iconURL: this.options.iconUrl })
            .addFields(
                category.commands.map((command) => ({
                    name: `/${command.name}`,
                    value: command.description,
                    inline: false
                }))
            );
    }

    public guide(user: DiscordEmbedUser): EmbedBuilder {
        return this.embeds
            .info(user)
            .setAuthor({ name: '猫咲 紬 - コマンドガイド', iconURL: this.options.iconUrl })
            .setDescription('現在、スラッシュコマンドに移行中です。\n今後の更新でプレフィックスコマンドはサポートされなくなります。')
            .setFields({
                name: 'コマンドの使用方法',
                value: '`/[コマンド名]`で使用できます。\n例: `/ping`\n以前のプレフィックスコマンドを使用する場合、`t#help`を使用して確認してください。'
            })
            .setTimestamp();
    }

    public error(user: DiscordEmbedUser, message: string): EmbedBuilder {
        return this.embeds.error(user, message);
    }
}
