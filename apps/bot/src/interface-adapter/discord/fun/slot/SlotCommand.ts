import { ChatInputCommandInteraction } from 'discord.js';

import type { SpinSlot } from '../../../../application/fun/slot/SpinSlot.js';
import { CommandInteraction } from '../../../../commands/base/command_base.js';
import CustomSlashCommandBuilder from '../../../../utils/CustomSlashCommandBuilder.js';
import { createRotatingSlotEmbed, createSlotResultEmbed } from './SlotEmbed.js';

/** スロットコマンド。 */
export class SlotCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('slot')
        .setDescription('スロットを回します')
        .setCategory('お遊び系')
        .setCooldown(5)
        .setUsage('`/slot`');

    public constructor(private readonly spinSlot: SpinSlot) {
        super();
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.editReply({ embeds: [createRotatingSlotEmbed(interaction)] });
        const result = await this.spinSlot.execute();
        await interaction.editReply({ embeds: [createSlotResultEmbed(interaction, result)] });
    }
}
