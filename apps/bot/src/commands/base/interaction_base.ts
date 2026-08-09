import {
    ApplicationCommandDataResolvable,
    Interaction,
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
    SlashCommandSubcommandGroupBuilder,
    SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';

import CustomSlashCommandBuilder from '../../utils/CustomSlashCommandBuilder.js';
/**
 * コマンド/ボタン/コンテキストメニューなどの操作の基底クラス
 */
export abstract class InteractionBase {
    /**
     * ApplicationCommandManagerにコマンドを登録する
     * commandListにpush_backして登録することで、すべてのコマンドの登録後にまとめてDiscordにコマンドが登録されます
     * @param _commandList ApplicationCommandManagerに登録するコマンドのリスト
     */
    public registerCommands(_commandList: ApplicationCommandDataResolvable[]): void {
        //
    }

    /**
     * 他のInteractionBase(コマンドなど)に対してサブコマンドを登録する
     * すべてのサブコマンドの登録後、registerCommands()が呼ばれます
     */
    public registerSubCommands(): void {
        //
    }

    /**
     * InteractionCreateイベントが発生したときに呼ばれる
     * 登録されているすべてのInteractionBaseに対して呼ばれます。
     * if文で必要な処理を行うか判断し、処理を行ってください。
     * @param _interaction InteractionCreateイベントが発生したときのInteraction
     */
    public async onInteractionCreate(_interaction: Interaction): Promise<void> {
        //
    }

    public command?:
        | CustomSlashCommandBuilder
        | SlashCommandBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | SlashCommandSubcommandBuilder
        | SlashCommandSubcommandGroupBuilder;
}
