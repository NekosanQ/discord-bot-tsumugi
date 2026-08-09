import { ChatInputCommandInteraction, ModalBuilder, PermissionsBitField } from 'discord.js';

import CustomSlashSubcommandBuilder from '../../utils/CustomSlashSubCommandBuilder.js';
import { CommandGroupInteraction, SubCommandInteraction } from '../base/command_base.js';
import { KeywordAddModal } from './action/KeywordAddModal.js';
/**
 * キーワード登録/更新コマンド
 */
export class KeywordAddCommand extends SubCommandInteraction {
    public command: CustomSlashSubcommandBuilder = new CustomSlashSubcommandBuilder()
        .setName('add')
        .setDescription('キーワードを登録/更新します。')
        .setCategory('キーワード応答機能')
        .setUsage('`/keyword add`')
        .setDefaultBotPermissions(PermissionsBitField.Flags.ManageGuild);

    public constructor(
        registry: CommandGroupInteraction,
        private readonly keywordAddModal: KeywordAddModal
    ) {
        super(registry);
    }

    protected override shouldDeferReply(): boolean {
        return false;
    }
    /** @inheritdoc */
    public async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const modal: ModalBuilder = this.keywordAddModal.create();
        await interaction.showModal(modal);
    }
}
