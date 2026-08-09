import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

import HelpCategoryMenuAction from './actions/HelpCategoryMenuAction.js';
import HelpOperationMenuAction from './actions/HelpOperationMenuAction.js';
/**
 * ヘルプコマンドのコンポーネントを作成する
 */
class HelpComponents {
    public async create(): Promise<ActionRowBuilder<StringSelectMenuBuilder>[]> {
        const categoryMenu = await HelpCategoryMenuAction.create();
        const operationMenu = await HelpOperationMenuAction.create();

        const categoryRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categoryMenu);
        const operationRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(operationMenu);
        return [categoryRow, operationRow];
    }
}
export default new HelpComponents();
