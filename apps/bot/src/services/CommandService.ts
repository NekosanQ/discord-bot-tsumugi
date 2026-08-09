import { CommandGroupInteraction, CommandInteraction, SubCommandInteraction } from '../commands/base/command_base.js';
import CommandHandler from '../commands/CommandHandler.js';

export interface CommandInfo {
    name: string;
    description: string;
}

export interface CategorizedCommands {
    category: string;
    commands: CommandInfo[];
}

export interface CommandHelpInfo {
    name: string;
    description: string;
    category: string;
    usage: string;
    defaultMemberPermissions: bigint;
    defaultBotPermissions: bigint;
}

class CommandService {
    private categorizedCommands: CategorizedCommands[] = [];
    private commandMap = new Map<string, CommandInteraction | SubCommandInteraction>();
    private commandNames: string[] = [];
    /**
     * サービスを初期化し、コマンド情報を一度だけ計算してキャッシュします。
     * @param commandHandler
     */
    public initialize(commandHandler: CommandHandler): void {
        const executableCommands = commandHandler.commands.filter(
            (c): c is CommandInteraction | SubCommandInteraction => c instanceof CommandInteraction || c instanceof SubCommandInteraction
        );

        const commandsCategoryMap: Record<string, CommandInfo[]> = {};

        for (const cmd of executableCommands) {
            const fullName = this.getCommandFullName(cmd);
            let category: string | undefined = undefined;
            if ('category' in cmd.command && typeof cmd.command.category === 'string') {
                category = cmd.command.category;
            } else if (cmd instanceof SubCommandInteraction) {
                const parent = cmd.registry;
                if (
                    parent instanceof CommandGroupInteraction &&
                    'command' in parent &&
                    'category' in parent.command &&
                    typeof parent.command.category === 'string'
                ) {
                    category = parent.command.category;
                }
            }

            if (category) {
                this.commandMap.set(fullName, cmd);

                if (!this.commandNames.includes(fullName)) {
                    this.commandNames.push(fullName);
                }

                commandsCategoryMap[category] ??= [];
                commandsCategoryMap[category].push({
                    name: fullName,
                    description: cmd.command.description
                });
            }
        }

        this.categorizedCommands = Object.entries(commandsCategoryMap).map(([category, commands]) => ({
            category,
            commands
        }));
    }

    /**
     * interactionインスタンスからフルネームを取得するヘルパーメソッド
     */
    private getCommandFullName(interaction: CommandInteraction | SubCommandInteraction): string {
        if (interaction instanceof SubCommandInteraction) {
            const parent = interaction.registry;
            if (parent instanceof CommandGroupInteraction) {
                return `${parent.command.name} ${interaction.command.name}`;
            }
        }
        return interaction.command.name;
    }
    /**
     * 指定された名前のコマンド情報をキャッシュから取得します
     */
    public findCommandName(name: string): CommandInteraction | SubCommandInteraction | undefined {
        return this.commandMap.get(name);
    }

    /**
     * コマンド名リストをキャッシュから取得します
     */
    public getCommandNames(): string[] {
        return this.commandNames;
    }

    /**
     * コマンドをカテゴリーごとに分類したリストをキャッシュから取得します
     */
    public getCommandsCategory(): CategorizedCommands[] {
        return this.categorizedCommands;
    }
}

export default new CommandService();
