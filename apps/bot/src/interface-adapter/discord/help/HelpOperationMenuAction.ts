import { ComponentType, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';

import { MessageComponentActionInteraction } from '../../../commands/base/action_base.js';
import type { HelpOperation, HelpOperationInteraction } from './operations/HelpOperation.js';

export interface HelpOperationMenuInteraction extends HelpOperationInteraction {
    deferUpdate: () => Promise<void>;
}

export class HelpOperationMenuAction extends MessageComponentActionInteraction<ComponentType.StringSelect> {
    public constructor(private readonly operations: ReadonlyMap<string, HelpOperation>) {
        super('help_operation', ComponentType.StringSelect);
    }

    public override create(): Promise<StringSelectMenuBuilder> {
        return Promise.resolve(
            new StringSelectMenuBuilder()
                .setCustomId(this.createCustomId())
                .setPlaceholder('操作・その他')
                .addOptions([
                    { label: 'ホームに戻る', value: 'home', emoji: '<:bot_7:1033763464084193411>' },
                    { label: 'メニューを固定', value: 'fixation', emoji: '<:bot_8:1033764501142634717>' },
                    { label: 'メニューを削除', value: 'delete', emoji: '<:bot_9:1033764520302223441>' },
                    { label: 'コマンドの使用方法・今後について', value: 'guide', emoji: '<:bot_10:1033764549653962793>' }
                ])
        );
    }

    public async operate(operationKey: string | undefined, interaction: HelpOperationMenuInteraction): Promise<void> {
        await interaction.deferUpdate();
        const operation = this.operations.get(operationKey ?? '');
        if (!operation) return;
        await operation.execute(interaction);
    }

    protected async onCommand(interaction: StringSelectMenuInteraction): Promise<void> {
        await this.operate(interaction.values[0], {
            user: interaction.user,
            deferUpdate: async (): Promise<void> => {
                await interaction.deferUpdate();
            },
            editEmbed: async (embed): Promise<void> => {
                await interaction.editReply({ embeds: [embed] });
            },
            clearComponents: async (): Promise<void> => {
                await interaction.editReply({ components: [] });
            },
            deleteMessage: async (): Promise<void> => {
                await interaction.message.delete();
            }
        });
    }
}
