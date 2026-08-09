import { StringSelectMenuInteraction } from 'discord.js';

import { IOperationStrategy } from './IOperationStrategy.js';

/**
 * メッセージの固定をする操作を行うクラス
 */
class FixationOperation implements IOperationStrategy {
    public async execute(interaction: StringSelectMenuInteraction): Promise<void> {
        await interaction.editReply({ components: [] });
    }
}

export default FixationOperation;
