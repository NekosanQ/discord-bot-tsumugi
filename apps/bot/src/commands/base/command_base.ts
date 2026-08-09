import {
    ApplicationCommandDataResolvable,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Interaction,
    MessageFlags,
    PermissionResolvable,
    PermissionsBitField,
    SlashCommandSubcommandGroupBuilder,
    SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';

import CustomSlashCommandBuilder from '../../utils/CustomSlashCommandBuilder.js';
import CustomSlashSubcommandBuilder from '../../utils/CustomSlashSubCommandBuilder.js';
import { InteractionBase } from './interaction_base.js';
/**
 * コマンドベースのインタラクション
 */
interface CommandBasedInteraction {
    /**
     * 自分のインタラクションかどうかを判定する
     * @param interaction インタラクション
     * @returns 自分のインタラクションかどうか
     */
    isMyInteraction(interaction: ChatInputCommandInteraction): boolean;
}

/**
 * コマンドグループ
 */
export abstract class CommandGroupInteraction extends InteractionBase implements CommandBasedInteraction {
    public abstract command: SlashCommandSubcommandsOnlyBuilder;

    /** @inheritdoc */
    public override registerCommands(commandList: ApplicationCommandDataResolvable[]): void {
        commandList.push(this.command);
    }

    /** @inheritdoc */
    public isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
        return interaction.commandName === this.command.name;
    }
}
/**
 * サブコマンドグループ
 */
export abstract class SubcommandGroupInteraction extends InteractionBase implements CommandBasedInteraction {
    public abstract command: SlashCommandSubcommandGroupBuilder;

    /**
     * コンストラクタ
     * @param _registry サブコマンドグループを登録する先
     */
    public constructor(private _registry: CommandGroupInteraction) {
        super();
    }

    /** @inheritdoc */
    public override registerSubCommands(): void {
        this._registry.command.addSubcommandGroup(this.command);
    }

    /** @inheritdoc */
    public isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
        return this._registry.isMyInteraction(interaction) && interaction.options.getSubcommandGroup(false) === this.command.name;
    }
}
/**
 * コマンド
 */
export abstract class CommandInteraction extends InteractionBase implements CommandBasedInteraction {
    public abstract command: CustomSlashCommandBuilder;

    /** @inheritdoc */
    public override registerCommands(commandList: ApplicationCommandDataResolvable[]): void {
        commandList.push(this.command);
    }

    /** @inheritdoc */
    public isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
        return interaction.commandName === this.command.name;
    }
    /**
     * 自動的に deferReplyを実行するか判定する
     * @remarks デフォルトではtrueを返します。必要に応じてオーバーライドすること。
     * @returns 自動的にdeferする場合はtrue
     */
    protected shouldDeferReply(): boolean {
        return true;
    }

    /** @inheritdoc */
    public override async onInteractionCreate(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand() || !this.isMyInteraction(interaction)) return;

        const permissionChecker = new PermissionChecker(this.command);

        if (!(await permissionChecker.checkPermissions(interaction))) return;

        if (this.shouldDeferReply()) {
            await interaction.deferReply();
        }
        await this.onCommand(interaction);
    }

    /**
     * コマンドが実行されたときに呼ばれる
     * @param interaction インタラクション
     */
    protected abstract onCommand(interaction: ChatInputCommandInteraction): Promise<void>;
}

/**
 * サブコマンド
 */
export abstract class SubCommandInteraction extends InteractionBase implements CommandBasedInteraction {
    public abstract command: CustomSlashSubcommandBuilder;
    public parentCommand?: CommandGroupInteraction | SubcommandGroupInteraction;

    /**
     * コンストラクタ
     * @param _registry サブコマンドグループを登録する先
     */
    public constructor(private _registry: CommandGroupInteraction | SubcommandGroupInteraction) {
        super();
    }

    /**
     * 親コマンド（グループ）を取得するゲッターを追加
     */
    public get registry(): CommandGroupInteraction | SubcommandGroupInteraction {
        return this._registry;
    }

    /** @inheritdoc */
    public override registerSubCommands(): void {
        this._registry.command.addSubcommand(this.command);
    }

    /** @inheritdoc */
    public isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
        return this._registry.isMyInteraction(interaction) && interaction.options.getSubcommand(false) === this.command.name;
    }
    /**
     * 自動的に deferReplyを実行するか判定する
     * @remarks デフォルトではtrueを返します。必要に応じてオーバーライドすること。
     * @returns 自動的にdeferする場合はtrue
     */
    protected shouldDeferReply(): boolean {
        return true;
    }

    /** @inheritdoc */
    public override async onInteractionCreate(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()) return;
        if (!this.isMyInteraction(interaction)) return;
        if (this.shouldDeferReply()) {
            await interaction.deferReply();
        }
        await this.onCommand(interaction);
    }

    /**
     * コマンドが実行されたときに呼ばれる
     * @param interaction インタラクション
     */
    public abstract onCommand(interaction: ChatInputCommandInteraction): Promise<void>;
}
/**
 * オートコンプリート付きコマンド
 */
export abstract class AutocompleteCommandInteraction extends InteractionBase implements CommandBasedInteraction {
    public abstract command: CustomSlashCommandBuilder;

    /** @inheritdoc */
    public override registerCommands(commandList: ApplicationCommandDataResolvable[]): void {
        commandList.push(this.command);
    }

    /** @inheritdoc */
    public isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
        return interaction.commandName === this.command.name;
    }
    /**
     * 自動的に deferReplyを実行するか判定する
     * @remarks デフォルトではtrueを返します。必要に応じてオーバーライドすること。
     * @returns 自動的にdeferする場合はtrue
     */
    protected shouldDeferReply(): boolean {
        return true;
    }

    /** @inheritdoc */
    public override async onInteractionCreate(interaction: Interaction): Promise<void> {
        if (interaction.isChatInputCommand() && this.isMyInteraction(interaction)) {
            const permissionChecker = new PermissionChecker(this.command);

            if (!(await permissionChecker.checkPermissions(interaction))) return;
            if (this.shouldDeferReply()) {
                await interaction.deferReply();
            }
            await this.onCommand(interaction);
        } else if (interaction.isAutocomplete()) {
            await this.onAutocomplete(interaction);
        }
    }

    /**
     * コマンドが実行されたときに呼ばれる
     * @param interaction インタラクション
     */
    protected abstract onCommand(interaction: ChatInputCommandInteraction): Promise<void>;
    /**
     * オートコンプリートが実行されたときに呼ばれる
     * @param interaction インタラクション
     */
    protected abstract onAutocomplete(interaction: AutocompleteInteraction): Promise<void>;
}
/**
 * 権限を確認するクラス
 */
export class PermissionChecker {
    private command: CustomSlashCommandBuilder;

    public constructor(command: CustomSlashCommandBuilder) {
        this.command = command;
    }
    /**
     * Botとメンバーの権限を確認する
     * @param interaction インタラクション
     * @returns 権限が満たされている場合はtrue、そうでない場合はfalse
     */
    public async checkPermissions(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const botPermissions = interaction.guild?.members.me?.permissions;
        const requiredBotPerms = this.command.defaultBotPermissions;

        if (requiredBotPerms && botPermissions) {
            const requiredPermsField = new PermissionsBitField(requiredBotPerms as PermissionResolvable);
            if (!botPermissions.has(requiredPermsField)) {
                const missingPerms = requiredPermsField.toArray().filter((p) => !botPermissions.has(p));

                await interaction.reply({
                    content: `Botに必要な権限が不足しています。\n不足している権限: \`${missingPerms.join(', ')}\``,
                    flags: MessageFlags.Ephemeral
                });
                return false;
            }
        }

        // メンバーの権限をチェック
        const memberPermissions = interaction.member?.permissions;
        const requiredMemberPerms = this.command.default_member_permissions;

        if (requiredMemberPerms && memberPermissions instanceof PermissionsBitField) {
            const requiredPermsField = new PermissionsBitField(requiredMemberPerms as PermissionResolvable);
            if (!memberPermissions.has(requiredPermsField)) {
                const missingPerms = requiredPermsField.toArray().filter((p) => !memberPermissions.has(p));

                await interaction.reply({
                    content: `コマンドの実行に必要な権限が不足しています。\n不足している権限: \`${missingPerms.join(', ')}\``,
                    flags: MessageFlags.Ephemeral
                });
                return false;
            }
        }

        return true;
    }
}
