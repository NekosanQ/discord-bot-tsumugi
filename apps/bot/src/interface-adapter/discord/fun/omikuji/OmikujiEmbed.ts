import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

import type { OmikujiResult } from '../../../../domain/fun/omikuji/Omikuji.js';
import { embeds } from '../../../../utils/EmbedGenerator.js';

export function createOmikujiEmbed(interaction: ChatInputCommandInteraction, result: OmikujiResult): EmbedBuilder {
    const description = `
        **運勢**
        ${result.fortune}

        **願望:** ${result.hope}
        **失物:** ${result.lostItem}
        **学問:** ${result.learning}
        **争事:** ${result.conflict}
        **恋愛:** ${result.love}
        **病気:** ${result.disease}
        `;

    return embeds.info(interaction.user).setTitle(`${interaction.user.displayName}さんのおみくじの結果`).setDescription(description);
}
