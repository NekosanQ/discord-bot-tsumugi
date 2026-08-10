import { ChatInputCommandInteraction } from 'discord.js';

import { CommandInteraction } from '../../../../commands/base/command_base.js';
import CustomSlashCommandBuilder from '../../../../utils/CustomSlashCommandBuilder.js';
import { PingController } from './PingController.js';

/** Discord入力をping controllerのDTOへ変換する。 */
export class PingCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('ping')
        .setDescription('Pingを表示します')
        .setCooldown(5)
        .setCategory('一般')
        .setUsage('`/ping`');

    public constructor(private readonly controller: PingController) {
        super();
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        await this.controller.execute({
            user: interaction.user,
            websocketPingMilliseconds: interaction.client.ws.ping,
            createdTimestamp: interaction.createdTimestamp,
            editReply: async (embed): Promise<void> => {
                await interaction.editReply({ embeds: [embed] });
            },
            fetchReplyCreatedTimestamp: async (): Promise<number> => (await interaction.fetchReply()).createdTimestamp
        });
    }
}
