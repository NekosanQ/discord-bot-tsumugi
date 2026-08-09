import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';

import { config } from '../../../utils/config.js';
import { dateTimeFormatter } from '../../../utils/dateTimeFormatter.js';
import { embeds } from '../../../utils/EmbedGenerator.js';
import { PermissionTranslator } from '../../../utils/PermissionTranslator.js';
import { statusAddEmoji } from '../../../utils/statusEmojiAdd.js';

class UserEmbed {
    private static readonly maxLength = 1000;

    /**
     * ユーザーIDを元にメンバー情報をAPIから取得し、情報（サーバー参加日、ロール、権限など）を含んだEmbedを作成します。
     * @param interaction コマンドのインタラクションオブジェクト
     * @returns ユーザー情報が設定されたEmbedBuilderインスタンス、またはエラー時のEmbed
     */
    public async create(interaction: ChatInputCommandInteraction): Promise<EmbedBuilder> {
        if (!interaction.guild) {
            return embeds.error(interaction.user, 'このコマンドはサーバー内でのみ使用できます。');
        }
        const targetUser = interaction.options.getUser('user') ?? interaction.user;

        let member: GuildMember;
        try {
            member = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            console.error(`メンバーの取得に失敗しました: ${targetUser.id}`, error);
            return embeds.error(interaction.user, 'メンバーの取得に失敗しました。');
        }

        const user = member.user;
        const roleList = member.roles.cache.filter((role) => role.id !== interaction.guild?.id).map((role) => role.toString());

        let roles: string;
        if (roleList.length === 0) {
            roles = 'なし';
        } else {
            let rolesString = '';
            let processedCount = 0;

            for (const role of roleList) {
                const separator = rolesString.length > 0 ? ', ' : '';
                const remainingCount = roleList.length - processedCount;
                const placeholderEllipsis = `, ...他${String(remainingCount)}件`;

                if (rolesString.length + separator.length + role.length + placeholderEllipsis.length > UserEmbed.maxLength) {
                    break;
                }

                rolesString += separator + role;
                processedCount++;
            }

            if (processedCount < roleList.length) {
                const remainingCount = String(roleList.length - processedCount);
                rolesString += `, ...他${remainingCount}件`;
            }

            roles = rolesString;
        }

        const permissionBitfield = member.permissions.bitfield;
        const permissions = new PermissionTranslator(permissionBitfield).permissionNames;

        const botEmoji = user.bot ? config.botEmoji : '';
        const userName = `ユーザー名(ID): ${user.username} (${user.id})`;
        const userGlobalName = `表示名: ${user.globalName ?? 'なし'}`;
        const userStatus = statusAddEmoji(member.presence?.status ?? 'offline');
        const accountCreationDate = `アカウント作成日: ${dateTimeFormatter(user.createdAt)}`;

        const guildJoinDate = `サーバー参加日: ${member.joinedAt ? dateTimeFormatter(member.joinedAt) : '不明'}`;
        const memberNickname = `ニックネーム: ${member.nickname ?? 'なし'}`;
        const memberPermissions = permissions.length > 0 ? permissions.map((name) => `\`${name}\``).join(', ') : 'なし';

        const basicInfo = [userName, userGlobalName, userStatus, accountCreationDate].join('\n');
        const memberInfo = [memberNickname, guildJoinDate].join('\n');

        const roleCount = member.roles.cache.size - 1;

        const embed = embeds
            .info(interaction.user)
            .setTitle(`ユーザー情報 ${botEmoji}`)
            .setFields(
                { name: '基本情報', value: basicInfo },
                { name: 'メンバー情報', value: memberInfo },
                { name: `役職 (${String(roleCount)})`, value: roles },
                { name: `権限 (${String(permissionBitfield)})`, value: memberPermissions }
            )
            .setThumbnail(user.displayAvatarURL());
        return embed;
    }
}

export default new UserEmbed();
