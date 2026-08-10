import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

import type { SlotResult } from '../../../../domain/fun/slot/Slot.js';
import { embeds } from '../../../../utils/EmbedGenerator.js';

export function createRotatingSlotEmbed(interaction: ChatInputCommandInteraction): EmbedBuilder {
    return embeds
        .info(interaction.user)
        .setTitle('スロットを回しています...')
        .setDescription('**回** | **転** | **中**\n**転** | **中** | **回**\n**中** | **回** | **転**');
}

export function createSlotResultEmbed(interaction: ChatInputCommandInteraction, result: SlotResult): EmbedBuilder {
    const [first, second, third] = result.reels;
    const embed = embeds.info(interaction.user).setTitle('スロットの結果').setDescription(`**${first} | ${second} | ${third}**`);

    if (result.outcome === 'jackpot') {
        embed.addFields({ name: '結果', value: '🎉 **大当たり！** 🎉' });
    } else if (result.outcome === 'nearMiss') {
        embed.addFields({ name: '結果', value: '惜しい！' });
    }

    return embed;
}
