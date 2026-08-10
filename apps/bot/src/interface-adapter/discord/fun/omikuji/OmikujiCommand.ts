import { ChatInputCommandInteraction } from 'discord.js';

import type { DrawOmikuji } from '../../../../application/fun/omikuji/DrawOmikuji.js';
import { CommandInteraction } from '../../../../commands/base/command_base.js';
import CustomSlashCommandBuilder from '../../../../utils/CustomSlashCommandBuilder.js';
import { createOmikujiEmbed } from './OmikujiEmbed.js';

/** おみくじコマンド。 */
export class OmikujiCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('omikuji')
        .setDescription('おみくじが引けます')
        .setCategory('お遊び系')
        .setCooldown(5)
        .setUsage('`/omikuji`');

    public constructor(private readonly drawOmikuji: DrawOmikuji) {
        super();
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const embed = createOmikujiEmbed(interaction, this.drawOmikuji.execute());
        await interaction.editReply({ embeds: [embed] });
    }
}
