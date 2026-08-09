import { Client } from 'discord.js';

import type { GuildInstallationManagement } from '../application/guild/GuildInstallationManagement.js';
import type { KeywordManagement } from '../application/keyword/KeywordManagement.js';
import CommandHandler from '../commands/CommandHandler.js';
import { ClientReadyEvent } from './ClientReadyEvent.js';
import type { AnyEventBase } from './EventHandler.js';
import { GuildCreateEvent } from './GuildCreateEvent.js';
import { GuildDeleteEvent } from './GuildDeleteEvent.js';
import { InteractionCreateEvent } from './InteractionCreateEvent.js';
import { MessageCreateEvent } from './MessageCreateEvent.js';

export interface EventFactoryDependencies {
    client: Client;
    commandHandler: CommandHandler;
    keywordManagement: KeywordManagement & GuildInstallationManagement;
}

export interface CreatedEvents {
    events: AnyEventBase[];
    stopBackgroundTasks: () => void;
}

export function createEvents(dependencies: EventFactoryDependencies): CreatedEvents {
    const readyEvent = new ClientReadyEvent(dependencies.client, dependencies.commandHandler);
    const interactionCreateEvent = new InteractionCreateEvent(dependencies.commandHandler);
    const messageCreateEvent = new MessageCreateEvent(dependencies.keywordManagement);
    const guildCreateEvent = new GuildCreateEvent(dependencies.keywordManagement);
    const guildDeleteEvent = new GuildDeleteEvent(dependencies.keywordManagement);

    return {
        events: [readyEvent, guildCreateEvent, guildDeleteEvent, interactionCreateEvent, messageCreateEvent],
        stopBackgroundTasks: (): void => {
            readyEvent.stop();
        }
    };
}
