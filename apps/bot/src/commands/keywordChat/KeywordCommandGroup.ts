import { InteractionContextType, PermissionsBitField } from 'discord.js';

import CustomSlashCommandBuilder from '../../utils/CustomSlashCommandBuilder.js';
import { CommandGroupInteraction } from '../base/command_base.js';

/**
 * キーワード応答機能に関するコマンドグループ
 */
export class KeywordCommandGroup extends CommandGroupInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('keyword')
        .setDescription('キーワード応答機能に関する設定を行います')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .setCategory('キーワード応答機能')
        .setCooldown(5)
        .setContexts(InteractionContextType.Guild);
}
