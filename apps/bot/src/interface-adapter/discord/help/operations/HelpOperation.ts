import type { EmbedBuilder } from 'discord.js';

import type { DiscordEmbedUser } from '../../presentation/DiscordEmbedFactory.js';

export interface HelpOperationInteraction {
    user: DiscordEmbedUser;
    editEmbed: (embed: EmbedBuilder) => Promise<void>;
    clearComponents: () => Promise<void>;
    deleteMessage: () => Promise<void>;
}

export interface HelpOperation {
    execute: (interaction: HelpOperationInteraction) => Promise<void>;
}
