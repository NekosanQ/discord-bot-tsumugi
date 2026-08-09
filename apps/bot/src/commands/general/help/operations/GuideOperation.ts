import { StringSelectMenuInteraction } from 'discord.js';

import HelpEmbed from '../HelpEmbed.js';
import { IOperationStrategy } from './IOperationStrategy.js';

/**
 * ガイドを表示する操作を行うクラス
 */
class GuideOperation implements IOperationStrategy {
    public async execute(interaction: StringSelectMenuInteraction): Promise<void> {
        const guideEmbed = HelpEmbed.createGuideEmbed(interaction);
        await interaction.editReply({ embeds: [guideEmbed] });
    }
}

export default GuideOperation;
