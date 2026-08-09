import { ChatInputCommandInteraction, EmbedBuilder, StringSelectMenuInteraction } from 'discord.js';

import { CategorizedCommands } from '../../../services/CommandService.js';
import { config } from '../../../utils/config.js';
import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { embeds } from '../../../utils/EmbedGenerator.js';
import { PermissionTranslator } from '../../../utils/PermissionTranslator.js';
import { CommandInteraction, SubCommandInteraction } from '../../base/command_base.js';

type HelpInteraction = ChatInputCommandInteraction | StringSelectMenuInteraction;
const translatePermission = (bitfield: bigint): string[] => new PermissionTranslator(bitfield).permissionNames;
/**
 * ヘルプコマンドに関連するEmbedを生成するクラス
 */
export class HelpEmbed {
    public createHomeEmbed(interaction: HelpInteraction, commandsCategoryList: CategorizedCommands[]): EmbedBuilder {
        const categoryPages =
            commandsCategoryList.length > 0
                ? commandsCategoryList.map((category, index) => `${String(index + 1)}ページ目: ${category.category}`).join('\n')
                : '利用可能なコマンドカテゴリはありません。';

        return embeds
            .info(interaction.user)
            .setAuthor({ name: '猫咲 紬 - ヘルプ', iconURL: config.iconURL })
            .setDescription('コマンドの詳細は`/help [コマンド名]`で表示できます。')
            .addFields(
                { name: '各カテゴリー', value: categoryPages },
                {
                    name: 'Botを招待/サポートサーバー',
                    value: `[Botを招待する](${config.inviteURL}) / [サポートサーバーに入る](${config.supportGuildURL})`
                }
            );
    }

    public createCommandInfoEmbed(interaction: ChatInputCommandInteraction, commandInfo: CommandInteraction | SubCommandInteraction): EmbedBuilder {
        const {
            name,
            description,
            category = '未分類',
            usage = '使用方法が設定されていません',
            cooldown = 'なし',
            defaultBotPermissions
        } = commandInfo.command;
        let defaultUserPermissions: string | number | bigint = 0;

        const cooldownText = typeof cooldown === 'number' ? `${String(cooldown)}秒` : 'なし';

        if (commandInfo instanceof CommandInteraction) {
            defaultUserPermissions = commandInfo.command.default_member_permissions ?? 0;
        } else if (commandInfo instanceof SubCommandInteraction) {
            const registerCommand = commandInfo.registry.command as CustomSlashCommandBuilder;
            defaultUserPermissions = registerCommand.default_member_permissions ?? 0;
        }
        const botPerms = BigInt(defaultBotPermissions ?? 0);
        const memberPerms = BigInt(defaultUserPermissions);
        const memberHasPermissions = interaction.memberPermissions?.has(memberPerms) ?? false;
        const botHasPermissions = interaction.guild?.members.me?.permissions.has(botPerms) ?? false;

        const permissionStatus = memberHasPermissions && botHasPermissions ? 'はい' : 'いいえ';
        const memberPermissionList = translatePermission(memberPerms).join('\n') || 'なし';
        const botPermissionList = translatePermission(botPerms).join('\n') || 'なし';

        return embeds
            .info(interaction.user)
            .setAuthor({ name: `猫咲 紬 - コマンド詳細 [${name}]`, iconURL: config.iconURL })
            .setDescription(description)
            .addFields(
                { name: 'カテゴリー', value: category },
                { name: '使用方法', value: usage },
                { name: 'クールダウン', value: cooldownText },
                { name: '実行可能か', value: permissionStatus, inline: true },
                { name: 'ユーザーに必要な権限', value: memberPermissionList, inline: true },
                { name: 'Botに必要な権限', value: botPermissionList, inline: true }
            );
    }
    /**
     * カテゴリごとのコマンドリストEmbedを作成する
     */
    public createCategoryEmbed(interaction: StringSelectMenuInteraction, categoryData: CategorizedCommands): EmbedBuilder {
        const commandList = categoryData.commands.map((command) => ({
            name: `/${command.name}`,
            value: command.description,
            inline: false
        }));

        return embeds
            .info(interaction.user)
            .setAuthor({ name: `猫咲 紬 - ${categoryData.category}`, iconURL: config.iconURL })
            .addFields(commandList);
    }
    /**
     * コマンドガイドのEmbedを作成する
     */
    public createGuideEmbed(interaction: StringSelectMenuInteraction): EmbedBuilder {
        return embeds
            .info(interaction.user)
            .setAuthor({ name: '猫咲 紬 - コマンドガイド', iconURL: config.iconURL })
            .setDescription('現在、スラッシュコマンドに移行中です。\n今後の更新でプレフィックスコマンドはサポートされなくなります。')
            .setFields({
                name: 'コマンドの使用方法',
                value: '`/[コマンド名]`で使用できます。\n例: `/ping`\n以前のプレフィックスコマンドを使用する場合、`t#help`を使用して確認してください。'
            })
            .setTimestamp();
    }
    /**
     * エラーEmbedを作成する
     */
    public createErrorEmbed(interaction: HelpInteraction, message: string): EmbedBuilder {
        return embeds.error(interaction.user, message);
    }
}

export default new HelpEmbed();
