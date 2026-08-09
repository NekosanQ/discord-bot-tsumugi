import { ChatInputCommandInteraction, ColorResolvable, EmbedBuilder } from 'discord.js';

import { embeds } from '../../../utils/EmbedGenerator.js';

export type Hand = 'rock' | 'scissors' | 'paper';
export interface GameResult {
    message: string;
    color: ColorResolvable;
}

export const HANDS: Record<Hand, { name: string; value: Hand }> = {
    rock: { name: 'グー✊', value: 'rock' },
    scissors: { name: 'チョキ✌️', value: 'scissors' },
    paper: { name: 'パー✋', value: 'paper' }
};

export const RESULTS: Record<'win' | 'lose' | 'draw', GameResult> = {
    win: { message: 'あなたの勝ちです！🎉', color: 0x57f287 },
    lose: { message: 'あなたの負けです...😢', color: 0xed4245 },
    draw: { message: 'あいこです！🤝', color: 0xfee75c }
};

/**
 * じゃんけんコマンドの埋め込みメッセージを作成する
 */
class RPCEmbed {
    /**
     * じゃんけんの結果を表示するEmbedを作成します。
     * @param interaction コマンドのインタラクション
     * @param userHand ユーザーが出した手
     * @param botHand Botが出した手
     * @param result 勝敗の結果
     * @returns 作成されたEmbedBuilder
     */
    public create(interaction: ChatInputCommandInteraction, userHand: Hand, botHand: Hand, result: GameResult): EmbedBuilder {
        return embeds
            .info(interaction.user)
            .setTitle('じゃんけんぽん！')
            .setDescription(result.message)
            .setColor(result.color)
            .addFields(
                { name: 'あなたの手', value: HANDS[userHand].name, inline: true },
                { name: 'Botの手', value: HANDS[botHand].name, inline: true }
            );
    }
}

export default new RPCEmbed();
