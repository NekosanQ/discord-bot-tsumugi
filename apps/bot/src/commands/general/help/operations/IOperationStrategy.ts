import { StringSelectMenuInteraction } from 'discord.js';

/**
 * 操作を行うためのインターフェース
 */
export interface IOperationStrategy {
    execute(interaction: StringSelectMenuInteraction): Promise<void>;
}
