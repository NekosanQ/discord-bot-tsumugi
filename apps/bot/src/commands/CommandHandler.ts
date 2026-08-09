import {
    ApplicationCommandDataResolvable,
    ChatInputCommandInteraction,
    Client,
    Interaction,
    InteractionReplyOptions,
    MessageFlags
} from 'discord.js';

import type { CooldownStore } from '../application/cooldown/CooldownStore.js';
import { embeds } from '../utils/EmbedGenerator.js';
import { logger } from '../utils/log.js';
import { IActionInteraction } from './base/action_base.js';
import { AutocompleteCommandInteraction, CommandGroupInteraction, CommandInteraction, SubCommandInteraction } from './base/command_base.js';
import { InteractionBase } from './base/interaction_base.js';

/**
 * コマンドハンドラー
 * アプリケーション全体のインタラクションを一元管理する
 */
export default class CommandHandler {
    private readonly commandMap = new Map<string, InteractionBase>();
    private readonly actionMap = new Map<string, IActionInteraction>();

    public readonly commands: InteractionBase[] = [];
    public readonly actions: IActionInteraction[] = [];

    private commandCount = 0;
    private subCommandCount = 0;

    private static readonly actionIdKey = '_';

    /**
     * コマンドハンドラーを初期化する
     * @param allInteractions 全インタラクションのリスト
     */
    public constructor(
        allInteractions: InteractionBase[],
        private readonly client: Client,
        private readonly guildId: string,
        private readonly cooldownStore: CooldownStore
    ) {
        allInteractions.forEach((interaction) => {
            this.registerInteraction(interaction);
        });

        logger.info(
            `読み込まれたコマンド: ${String(this.commandCount)}件, サブコマンド: ${String(this.subCommandCount)}件, アクション: ${String(this.actions.length)}件`
        );
    }

    /**
     * コマンドをDiscord APIに登録する
     */
    public async registerCommands(): Promise<void> {
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            const applicationCommands: ApplicationCommandDataResolvable[] = [];

            this.commands.forEach((command) => {
                command.registerSubCommands();
                command.registerCommands(applicationCommands);
            });

            await guild.commands.set(applicationCommands);
            logger.info(`${String(applicationCommands.length)}個のコマンドを登録しました。`);
        } catch (error) {
            logger.error('コマンドの登録中にエラーが発生しました:', error);
        }
    }

    /**
     * Interaction発生時に対応する処理を呼び出します
     * @param interaction インタラクション
     */
    public async onInteractionCreate(interaction: Interaction): Promise<void> {
        try {
            if (interaction.isChatInputCommand()) {
                await this.chatInputCommand(interaction);
            } else if ('customId' in interaction && typeof interaction.customId === 'string') {
                await this.actionInteraction(interaction);
            } else if (interaction.isAutocomplete()) {
                await this.handleAutocomplete(interaction);
            }
        } catch (error) {
            await this.interactionError(interaction, error);
        }
    }

    /**
     * コマンドの処理
     */
    private async chatInputCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const subcommand = interaction.options.getSubcommand(false);
        const commandKey = subcommand ? `${interaction.commandName} ${subcommand}` : interaction.commandName;
        const command = this.commandMap.get(commandKey);

        if (!command) {
            logger.warn(`不明なコマンドキー[${commandKey}]が実行されました。`);
            return;
        }

        const commandData = command.command as { cooldown?: number };
        if (await this.isCooldown(interaction, commandKey, commandData.cooldown)) {
            return;
        }

        await command.onInteractionCreate(interaction);
    }

    /**
     * アクションの処理
     */
    private async actionInteraction(interaction: Interaction): Promise<void> {
        if (!('customId' in interaction) || typeof interaction.customId !== 'string') return;

        const params = new URLSearchParams(interaction.customId);
        const actionId = params.get(CommandHandler.actionIdKey);

        if (!actionId) return;

        const action = this.actionMap.get(actionId);
        if (!action) {
            logger.warn(`不明なアクションID[${actionId}]を持つインタラクションが実行されました。`);
            return;
        }
        await action.onInteractionCreate(interaction);
    }

    /**
     * オートコンプリートの処理
     */
    private async handleAutocomplete(interaction: Interaction): Promise<void> {
        if (!interaction.isAutocomplete()) return;

        const command = this.commandMap.get(interaction.commandName);
        if (command instanceof AutocompleteCommandInteraction) {
            await command.onInteractionCreate(interaction);
        }
    }

    /**
     * インタラクション処理中のエラーハンドリング
     */
    private async interactionError(interaction: Interaction, error: unknown): Promise<void> {
        logger.error('インタラクションの処理中にエラーが発生しました:', error);

        if (!interaction.isRepliable()) return;

        const errorEmbed = embeds.error(interaction.user, '処理中に予期せぬエラーが発生しました。\n時間をおいて再度お試しください。');

        const replyOptions: InteractionReplyOptions = {
            embeds: [errorEmbed],
            flags: [MessageFlags.Ephemeral]
        };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyOptions);
            } else {
                await interaction.reply(replyOptions);
            }
        } catch (error) {
            logger.error('エラーメッセージの送信に失敗しました:', error);
        }
    }

    /**
     * 渡されたInteractionを分類し、それぞれのMapに登録する
     */
    private registerInteraction(interaction: InteractionBase): void {
        if ('id' in interaction && typeof (interaction as IActionInteraction).id === 'string') {
            const action = interaction as IActionInteraction;
            this.actions.push(action);
            this.actionMap.set(action.id, action);
        }

        if (!interaction.command?.name) return;

        this.commands.push(interaction);

        if (interaction instanceof SubCommandInteraction) {
            this.subCommandCount++;
            const parent = interaction.registry;
            if (parent instanceof CommandGroupInteraction) {
                const fullName = `${parent.command.name} ${interaction.command.name}`;
                this.commandMap.set(fullName, interaction);
            }
        } else if (
            interaction instanceof CommandInteraction ||
            interaction instanceof CommandGroupInteraction ||
            interaction instanceof AutocompleteCommandInteraction
        ) {
            this.commandCount++;
            this.commandMap.set(interaction.command.name, interaction);
        }
    }

    /**
     * コマンドのクールダウンを処理します
     */
    private async isCooldown(interaction: ChatInputCommandInteraction, commandKey: string, cooldownSeconds?: number): Promise<boolean> {
        if (!cooldownSeconds || cooldownSeconds <= 0) return false;

        const cooldownAmount = cooldownSeconds * 1000;
        const userId = interaction.user.id;
        const decision = await this.cooldownStore.acquire({ commandKey, userId }, cooldownAmount);

        if (!decision.acquired) {
            const expirationTime = Date.now() + decision.retryAfterMs;
            const expiredTimestamp = Math.round(expirationTime / 1000);

            const timeLeftEmbed = embeds.error(
                interaction.user,
                `このコマンドはクールダウン中です。\n<t:${String(expiredTimestamp)}:R> に再試行してください。`
            );

            await interaction.reply({
                embeds: [timeLeftEmbed],
                flags: MessageFlags.Ephemeral
            });
            return true;
        }
        return false;
    }
}
