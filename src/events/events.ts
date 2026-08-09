import { PrismaClient } from '@prisma/client';
import { Client } from 'discord.js';

import CommandHandler from '../commands/CommandHandler.js';
import { ClientReadyEvent } from './ClientReadyEvent.js';
import type { AnyEventBase } from './EventHandler.js';
import guildCreate from './GuildCreateEvent.js';
import guildDelete from './GuildDeleteEvent.js';
import { InteractionCreateEvent } from './InteractionCreateEvent.js';
import { MessageCreateEvent } from './MessageCreateEvent.js';

export interface EventFactoryDependencies {
    client: Client;
    commandHandler: CommandHandler;
    prisma: PrismaClient;
}

export interface CreatedEvents {
    events: AnyEventBase[];
    stopBackgroundTasks: () => void;
}

export function createEvents(dependencies: EventFactoryDependencies): CreatedEvents {
    const readyEvent = new ClientReadyEvent(dependencies.client, dependencies.commandHandler);
    const interactionCreateEvent = new InteractionCreateEvent(dependencies.commandHandler);
    const messageCreateEvent = new MessageCreateEvent(dependencies.prisma);

    return {
        events: [readyEvent, guildCreate, guildDelete, interactionCreateEvent, messageCreateEvent],
        stopBackgroundTasks: (): void => {
            readyEvent.stop();
        }
    };
}
