import type { EmbedBuilder } from 'discord.js';

import { MeasurePing } from '../../../../application/general/ping/MeasurePing.js';
import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';
import { PingPresenter } from './PingPresenter.js';

export interface PingInteraction {
    user: DiscordEmbedUser;
    websocketPingMilliseconds: number;
    createdTimestamp: number;
    editReply: (embed: EmbedBuilder) => Promise<void>;
    fetchReplyCreatedTimestamp: () => Promise<number>;
}

export class PingController {
    public constructor(
        private readonly measurePing: MeasurePing,
        private readonly presenter: PingPresenter
    ) {}

    public async execute(interaction: PingInteraction): Promise<void> {
        await interaction.editReply(this.presenter.measuring(interaction.user));
        const replyCreatedTimestamp = await interaction.fetchReplyCreatedTimestamp();
        const measurement = this.measurePing.execute({
            websocketPingMilliseconds: interaction.websocketPingMilliseconds,
            interactionCreatedTimestamp: interaction.createdTimestamp,
            replyCreatedTimestamp
        });
        await interaction.editReply(this.presenter.result(interaction.user, measurement));
    }
}
