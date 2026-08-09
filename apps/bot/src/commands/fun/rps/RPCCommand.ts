import { ChatInputCommandInteraction } from 'discord.js';

import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { CommandInteraction } from '../../base/command_base.js';
import RPCEmbed, { Hand, HANDS, RESULTS } from './RPCEmbed.js';

const CHOICES = Object.values(HANDS);
const BOT_HANDS = Object.keys(HANDS) as Hand[];

const WINS_AGAINST: Record<Hand, Hand> = {
    rock: 'scissors',
    scissors: 'paper',
    paper: 'rock'
};
/**
 * じゃんけんコマンド
 */
class RPCCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('rpc')
        .setDescription('Botとじゃんけんをします。')
        .setCategory('お遊び系')
        .setCooldown(5)
        .setUsage('`/rpc hand:[グー/チョキ/パー]`')
        .addStringOption((option) =>
            option
                .setName('hand')
                .setDescription('あなたの手を選んでください。')
                .setRequired(true)
                .addChoices(...CHOICES)
        ) as CustomSlashCommandBuilder;

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const userHand = interaction.options.getString('hand', true) as Hand;
        const botHand = BOT_HANDS[Math.floor(Math.random() * BOT_HANDS.length)];

        let result;
        if (userHand === botHand) {
            result = RESULTS.draw;
        } else if (WINS_AGAINST[userHand] === botHand) {
            result = RESULTS.win;
        } else {
            result = RESULTS.lose;
        }

        const embed = RPCEmbed.create(interaction, userHand, botHand, result);

        await interaction.editReply({ embeds: [embed] });
    }
}

export default new RPCCommand();
