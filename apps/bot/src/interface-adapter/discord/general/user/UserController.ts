import type { EmbedBuilder } from 'discord.js';

import { GetUserInformation } from '../../../../application/general/user/GetUserInformation.js';
import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';
import { UserPresenter } from './UserPresenter.js';

export interface UserInteraction {
    user: DiscordEmbedUser;
    guildId: string | null;
    targetUserId: string;
    editReply: (embed: EmbedBuilder) => Promise<void>;
}

export class UserController {
    public constructor(
        private readonly getUserInformation: GetUserInformation,
        private readonly presenter: UserPresenter
    ) {}

    public async execute(interaction: UserInteraction): Promise<void> {
        const result = await this.getUserInformation.execute({
            guildId: interaction.guildId,
            targetUserId: interaction.targetUserId
        });
        await interaction.editReply(this.presenter.present(interaction.user, result));
    }
}
