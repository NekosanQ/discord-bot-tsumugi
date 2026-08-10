import type { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';

import { GetBotInformation } from '../../../../application/general/bot/GetBotInformation.js';
import type { CommandFailureLogger } from '../../../../application/general/CommandFailureLogger.js';
import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';
import { BotPresenter } from './BotPresenter.js';

export interface BotInteraction {
    user: DiscordEmbedUser;
    editReply: (embed: EmbedBuilder, components: ActionRowBuilder<ButtonBuilder>) => Promise<void>;
}

export class BotController {
    public constructor(
        private readonly getBotInformation: GetBotInformation,
        private readonly presenter: BotPresenter,
        private readonly logger: CommandFailureLogger
    ) {}

    public async execute(interaction: BotInteraction): Promise<void> {
        try {
            const presentation = this.presenter.present(interaction.user, this.getBotInformation.execute());
            await interaction.editReply(presentation.embed, presentation.components);
        } catch (error) {
            this.logger.failure('bot-information', error);
        }
    }
}
