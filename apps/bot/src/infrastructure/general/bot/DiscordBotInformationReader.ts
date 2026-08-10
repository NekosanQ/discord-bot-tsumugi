import { Client } from 'discord.js';

import pkg from '../../../../package.json' with { type: 'json' };
import type { BotInformationReader, BotInformationSnapshot } from '../../../application/general/bot/BotInformationReader.js';

export class DiscordBotInformationReader implements BotInformationReader {
    public constructor(private readonly client: Client) {}

    public read(): BotInformationSnapshot {
        return {
            username: this.client.user?.username ?? '不明なBot',
            version: pkg.version,
            createdAt: this.client.user?.createdAt,
            guildCount: this.client.guilds.cache.size,
            userCount: this.client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0)
        };
    }
}
