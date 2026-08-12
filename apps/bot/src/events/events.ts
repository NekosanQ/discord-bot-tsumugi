import { Client } from 'discord.js';

import type { KeywordManagement } from '../application/keyword/KeywordManagement.js';
import CommandHandler from '../commands/CommandHandler.js';
import type { GuildSnapshotEventSynchronizer } from '../interface-adapter/discord/guild-snapshot/DiscordGuildSnapshotSynchronizer.js';
import {
    GuildSnapshotChannelCreateEvent,
    GuildSnapshotChannelDeleteEvent,
    GuildSnapshotChannelUpdateEvent,
    GuildSnapshotGuildCreateEvent,
    GuildSnapshotGuildDeleteEvent,
    GuildSnapshotReadyEvent
} from '../interface-adapter/discord/guild-snapshot/GuildSnapshotEvents.js';
import { ClientReadyEvent } from './ClientReadyEvent.js';
import type { AnyEventBase } from './EventHandler.js';
import { GuildCreateEvent } from './GuildCreateEvent.js';
import { GuildDeleteEvent } from './GuildDeleteEvent.js';
import { InteractionCreateEvent } from './InteractionCreateEvent.js';
import { MessageCreateEvent } from './MessageCreateEvent.js';

export interface EventFactoryDependencies {
    client: Client;
    commandHandler: CommandHandler;
    guildSnapshots: GuildSnapshotEventSynchronizer;
    keywordManagement: KeywordManagement;
}

export interface CreatedEvents {
    events: AnyEventBase[];
    stopBackgroundTasks: () => void;
}

export function createEvents(dependencies: EventFactoryDependencies): CreatedEvents {
    const readyEvent = new ClientReadyEvent(dependencies.client, dependencies.commandHandler);
    const interactionCreateEvent = new InteractionCreateEvent(dependencies.commandHandler);
    const messageCreateEvent = new MessageCreateEvent(dependencies.keywordManagement);
    const guildCreateEvent = new GuildCreateEvent();
    const guildDeleteEvent = new GuildDeleteEvent();
    const snapshotEvents = [
        new GuildSnapshotReadyEvent(dependencies.client, dependencies.guildSnapshots),
        new GuildSnapshotGuildCreateEvent(dependencies.guildSnapshots),
        new GuildSnapshotGuildDeleteEvent(dependencies.guildSnapshots),
        new GuildSnapshotChannelCreateEvent(dependencies.guildSnapshots),
        new GuildSnapshotChannelDeleteEvent(dependencies.guildSnapshots),
        new GuildSnapshotChannelUpdateEvent(dependencies.guildSnapshots)
    ];

    return {
        events: [readyEvent, ...snapshotEvents, guildCreateEvent, guildDeleteEvent, interactionCreateEvent, messageCreateEvent],
        stopBackgroundTasks: (): void => {
            readyEvent.stop();
        }
    };
}
