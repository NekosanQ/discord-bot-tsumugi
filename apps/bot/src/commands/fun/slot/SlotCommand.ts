import { ChatInputCommandInteraction } from 'discord.js';

import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { CommandInteraction } from '../../base/command_base.js';
import SlotEmbed from './SlotEmbed.js';

const REELS = ['7️⃣', '🍒', '🍋', '🔔', '🍉', '⭐', '💎'];
/**
 * スロットコマンド
 */
class SlotCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('slot')
        .setDescription('スロットを回します')
        .setCategory('お遊び系')
        .setCooldown(5)
        .setUsage('`/slot`');

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const rotatingEmbed = SlotEmbed.createRotatingEmbed(interaction);
        await interaction.editReply({ embeds: [rotatingEmbed] });

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const results = [
            REELS[Math.floor(Math.random() * REELS.length)],
            REELS[Math.floor(Math.random() * REELS.length)],
            REELS[Math.floor(Math.random() * REELS.length)]
        ];

        const finalEmbed = SlotEmbed.createResultEmbed(interaction, results);
        await interaction.editReply({ embeds: [finalEmbed] });
    }
}

export default new SlotCommand();
