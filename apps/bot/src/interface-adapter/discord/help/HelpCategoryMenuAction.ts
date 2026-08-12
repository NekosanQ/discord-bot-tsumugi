import { ComponentType, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';

import type { CommandCatalog } from '../../../application/help/CommandCatalog.js';
import { MessageComponentActionInteraction } from '../../../commands/base/action_base.js';
import type { DiscordEmbedUser } from '../presentation/DiscordEmbedFactory.js';
import { HelpPresenter } from './HelpPresenter.js';

export interface HelpCategoryInteraction {
    user: DiscordEmbedUser;
    selectedCategory: string | undefined;
    update: (embed: EmbedBuilder, clearComponents: boolean) => Promise<void>;
}

export class HelpCategoryMenuAction extends MessageComponentActionInteraction<ComponentType.StringSelect> {
    public constructor(
        private readonly catalog: CommandCatalog,
        private readonly presenter: HelpPresenter
    ) {
        super('help_category', ComponentType.StringSelect);
    }

    public override create(): Promise<StringSelectMenuBuilder> {
        const categoryOptions = this.catalog.categories().map((category, index) => ({
            label: `${String(index + 1)}ページ目: ${category.category}`,
            description: `カテゴリー: ${category.category} のコマンドを表示します`,
            value: category.category
        }));
        return Promise.resolve(
            new StringSelectMenuBuilder().setCustomId(this.createCustomId()).setPlaceholder('カテゴリを選択').addOptions(categoryOptions)
        );
    }

    public async select(interaction: HelpCategoryInteraction): Promise<void> {
        const category = this.catalog.categories().find((candidate) => candidate.category === interaction.selectedCategory);
        if (!category) {
            await interaction.update(this.presenter.error(interaction.user, '指定されたカテゴリが見つかりませんでした。'), true);
            return;
        }
        await interaction.update(this.presenter.category(interaction.user, category), false);
    }

    protected async onCommand(interaction: StringSelectMenuInteraction): Promise<void> {
        await this.select({
            user: interaction.user,
            selectedCategory: interaction.values[0],
            update: async (embed, clearComponents): Promise<void> => {
                await interaction.update({ embeds: [embed], ...(clearComponents ? { components: [] } : {}) });
            }
        });
    }
}
