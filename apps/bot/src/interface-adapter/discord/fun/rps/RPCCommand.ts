import { ChatInputCommandInteraction } from 'discord.js';

import type { PlayRockPaperScissors } from '../../../../application/fun/rps/PlayRockPaperScissors.js';
import { CommandInteraction } from '../../../../commands/base/command_base.js';
import type { RockPaperScissorsHand } from '../../../../domain/fun/rps/RockPaperScissors.js';
import CustomSlashCommandBuilder from '../../../../utils/CustomSlashCommandBuilder.js';
import { createRockPaperScissorsEmbed, HANDS } from './RPCEmbed.js';

const CHOICES = Object.values(HANDS);

/** じゃんけんコマンド。 */
export class RPCCommand extends CommandInteraction {
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

    public constructor(private readonly playRockPaperScissors: PlayRockPaperScissors) {
        super();
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const userHand = interaction.options.getString('hand', true) as RockPaperScissorsHand;
        const embed = createRockPaperScissorsEmbed(interaction, this.playRockPaperScissors.execute(userHand));
        await interaction.editReply({ embeds: [embed] });
    }
}
