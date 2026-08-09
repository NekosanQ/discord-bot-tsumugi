import { StringSelectMenuInteraction } from 'discord.js';

import { IOperationStrategy } from './IOperationStrategy.js';

/**
 * メッセージを削除する操作を行うクラス
 */
class DeleteOperation implements IOperationStrategy {
    public async execute(interaction: StringSelectMenuInteraction): Promise<void> {
        await interaction.message.delete();
    }
}

export default DeleteOperation;
