import { ComponentType, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';

import CommandService from '../../../../services/CommandService.js';
import { MessageComponentActionInteraction } from '../../../base/action_base.js';
import HelpEmbed from '../HelpEmbed.js';
/**
 * ヘルプのカテゴリーメニューの作成と処理を行う
 */
class HelpCategoryMenuAction extends MessageComponentActionInteraction<ComponentType.StringSelect> {
    public override create(): Promise<StringSelectMenuBuilder> {
        const customId = this.createCustomId();
        const commandsCategoryList = CommandService.getCommandsCategory();

        const categoryOptions = commandsCategoryList.map((category, index) => ({
            label: `${String(index + 1)}ページ目: ${category.category}`,
            description: `カテゴリー: ${category.category} のコマンドを表示します`,
            value: category.category
        }));

        const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('カテゴリを選択').addOptions(categoryOptions);
        return Promise.resolve(menu);
    }

    protected async onCommand(interaction: StringSelectMenuInteraction): Promise<void> {
        const selectedCategory = interaction.values[0];
        const commandsCategoryList = CommandService.getCommandsCategory();
        const categoryData = commandsCategoryList.find((cat) => cat.category === selectedCategory);

        if (!categoryData) {
            await interaction.update({
                embeds: [HelpEmbed.createErrorEmbed(interaction, '指定されたカテゴリが見つかりませんでした。')],
                components: []
            });
            return;
        }

        const categoryEmbed = HelpEmbed.createCategoryEmbed(interaction, categoryData);
        await interaction.update({ embeds: [categoryEmbed] });
    }
}

export default new HelpCategoryMenuAction('help_category', ComponentType.StringSelect);
