import { StringSelectMenuInteraction } from 'discord.js';

import CommandService from '../../../../services/CommandService.js';
import HelpEmbed from '../HelpEmbed.js';
import { IOperationStrategy } from './IOperationStrategy.js';

/**
 * ホームを表示する操作を行うクラス
 */
class HomeOperation implements IOperationStrategy {
    public async execute(interaction: StringSelectMenuInteraction): Promise<void> {
        const commandsCategoryList = CommandService.getCommandsCategory();
        const homeEmbed = HelpEmbed.createHomeEmbed(interaction, commandsCategoryList);
        await interaction.editReply({ embeds: [homeEmbed] });
    }
}

export default HomeOperation;
