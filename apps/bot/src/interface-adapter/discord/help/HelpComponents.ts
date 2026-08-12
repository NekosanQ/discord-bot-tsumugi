import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

import { HelpCategoryMenuAction } from './HelpCategoryMenuAction.js';
import { HelpOperationMenuAction } from './HelpOperationMenuAction.js';

export class HelpComponents {
    public constructor(
        private readonly categoryMenuAction: HelpCategoryMenuAction,
        private readonly operationMenuAction: HelpOperationMenuAction
    ) {}

    public async create(): Promise<ActionRowBuilder<StringSelectMenuBuilder>[]> {
        const categoryMenu = await this.categoryMenuAction.create();
        const operationMenu = await this.operationMenuAction.create();
        return [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categoryMenu),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(operationMenu)
        ];
    }
}
