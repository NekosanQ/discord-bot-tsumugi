import { ChatInputCommandInteraction, ColorResolvable, EmbedBuilder } from 'discord.js';

import type { RockPaperScissorsHand, RockPaperScissorsOutcome, RockPaperScissorsResult } from '../../../../domain/fun/rps/RockPaperScissors.js';
import { embeds } from '../../../../utils/EmbedGenerator.js';

interface GameResultPresentation {
    message: string;
    color: ColorResolvable;
}

export const HANDS: Record<RockPaperScissorsHand, { name: string; value: RockPaperScissorsHand }> = {
    rock: { name: 'グー✊', value: 'rock' },
    scissors: { name: 'チョキ✌️', value: 'scissors' },
    paper: { name: 'パー✋', value: 'paper' }
};

const RESULTS: Record<RockPaperScissorsOutcome, GameResultPresentation> = {
    win: { message: 'あなたの勝ちです！🎉', color: 0x57f287 },
    lose: { message: 'あなたの負けです...😢', color: 0xed4245 },
    draw: { message: 'あいこです！🤝', color: 0xfee75c }
};

/** じゃんけん結果をDiscordのEmbedへ変換する。 */
export function createRockPaperScissorsEmbed(interaction: ChatInputCommandInteraction, game: RockPaperScissorsResult): EmbedBuilder {
    const presentation = RESULTS[game.outcome];
    return embeds
        .info(interaction.user)
        .setTitle('じゃんけんぽん！')
        .setDescription(presentation.message)
        .setColor(presentation.color)
        .addFields(
            { name: 'あなたの手', value: HANDS[game.userHand].name, inline: true },
            { name: 'Botの手', value: HANDS[game.botHand].name, inline: true }
        );
}
