import { EmbedBuilder } from 'discord.js';

import type { PingMeasurement } from '../../../../application/general/ping/MeasurePing.js';
import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';
import { DiscordEmbedFactory } from '../../presentation/DiscordEmbedFactory.js';

export class PingPresenter {
    public constructor(private readonly embeds: DiscordEmbedFactory) {}

    public measuring(user: DiscordEmbedUser): EmbedBuilder {
        return this.embeds.info(user).setTitle('Pingを測定中...');
    }

    public result(user: DiscordEmbedUser, measurement: PingMeasurement): EmbedBuilder {
        return this.embeds
            .info(user)
            .setTitle('Pingを測定しました')
            .setFields({ name: 'WebSocket Ping', value: measurement.websocketPing }, { name: 'APIレイテンシ', value: measurement.apiLatency });
    }
}
