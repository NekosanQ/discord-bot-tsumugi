import { ComponentType, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';

import { MessageComponentActionInteraction } from '../../../base/action_base.js';
import DeleteOperation from '../operations/DeleteOperation.js';
import FixationOperation from '../operations/FixationOperation.js';
import GuideOperation from '../operations/GuideOperation.js';
import HomeOperation from '../operations/HomeOperation.js';
import { IOperationStrategy } from '../operations/IOperationStrategy.js';
/**
 * ヘルプの操作メニューの作成と処理を行う
 */
class HelpOperationMenuAction extends MessageComponentActionInteraction<ComponentType.StringSelect> {
    private readonly operations: Map<string, IOperationStrategy>;

    public constructor(customId: string, type: ComponentType.StringSelect) {
        super(customId, type);
        this.operations = new Map<string, IOperationStrategy>([
            ['home', new HomeOperation()],
            ['fixation', new FixationOperation()],
            ['delete', new DeleteOperation()],
            ['guide', new GuideOperation()]
        ]);
    }

    public override async create(): Promise<StringSelectMenuBuilder> {
        const customId = this.createCustomId();
        const menu = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder('操作・その他')
            .addOptions([
                { label: 'ホームに戻る', value: 'home', emoji: '<:bot_7:1033763464084193411>' },
                { label: 'メニューを固定', value: 'fixation', emoji: '<:bot_8:1033764501142634717>' },
                { label: 'メニューを削除', value: 'delete', emoji: '<:bot_9:1033764520302223441>' },
                { label: 'コマンドの使用方法・今後について', value: 'guide', emoji: '<:bot_10:1033764549653962793>' }
            ]);
        return Promise.resolve(menu);
    }

    public async onCommand(interaction: StringSelectMenuInteraction): Promise<void> {
        await interaction.deferUpdate();
        const operationKey = interaction.values[0];
        const operation = this.operations.get(operationKey);

        if (operation) {
            await operation.execute(interaction);
        }
    }
}

export default new HelpOperationMenuAction('help_operation', ComponentType.StringSelect);
