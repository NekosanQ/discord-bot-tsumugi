import type { EmbedBuilder } from 'discord.js';

import { GetGuildInformation } from '../../../../application/general/guild/GetGuildInformation.js';
import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';
import { GuildPresenter } from './GuildPresenter.js';

export interface GuildInteraction {
    user: DiscordEmbedUser;
    guildId: string | null;
    editReply: (embed: EmbedBuilder) => Promise<void>;
}

export class GuildController {
    public constructor(
        private readonly getGuildInformation: GetGuildInformation,
        private readonly presenter: GuildPresenter
    ) {}

    public async execute(interaction: GuildInteraction): Promise<void> {
        await interaction.editReply(this.presenter.present(interaction.user, await this.getGuildInformation.execute(interaction.guildId)));
    }
}
