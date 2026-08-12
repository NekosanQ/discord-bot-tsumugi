import type { DMChannel, NonThreadGuildBasedChannel } from 'discord.js';

import { EventBase } from '../../../events/base/event_base.js';
import type {
    DiscordClientGuildSnapshotSource,
    DiscordGuildSnapshotSource,
    GuildSnapshotEventSynchronizer
} from './DiscordGuildSnapshotSynchronizer.js';

interface GuildChannelEventSource {
    readonly guild?: DiscordGuildSnapshotSource;
}

export class GuildSnapshotReadyEvent extends EventBase<'clientReady'> {
    public eventName = 'clientReady' as const;

    public constructor(
        private readonly client: DiscordClientGuildSnapshotSource,
        private readonly snapshots: GuildSnapshotEventSynchronizer
    ) {
        super();
    }

    public async listener(): Promise<void> {
        await this.snapshots.synchronizeClient(this.client);
    }
}

export class GuildSnapshotGuildCreateEvent extends EventBase<'guildCreate'> {
    public eventName = 'guildCreate' as const;

    public constructor(private readonly snapshots: GuildSnapshotEventSynchronizer) {
        super();
    }

    public async listener(guild: DiscordGuildSnapshotSource): Promise<void> {
        await this.snapshots.synchronizeGuild(guild, 'guild-create');
    }
}

export class GuildSnapshotGuildDeleteEvent extends EventBase<'guildDelete'> {
    public eventName = 'guildDelete' as const;

    public constructor(private readonly snapshots: GuildSnapshotEventSynchronizer) {
        super();
    }

    public async listener(guild: { readonly id: string }): Promise<void> {
        await this.snapshots.synchronizeDeletedGuild(guild.id);
    }
}

export class GuildSnapshotChannelCreateEvent extends EventBase<'channelCreate'> {
    public eventName = 'channelCreate' as const;

    public constructor(private readonly snapshots: GuildSnapshotEventSynchronizer) {
        super();
    }

    public async listener(channel: GuildChannelEventSource): Promise<void> {
        if (channel.guild) await this.snapshots.synchronizeGuild(channel.guild, 'channel-create');
    }
}

export class GuildSnapshotChannelDeleteEvent extends EventBase<'channelDelete'> {
    public eventName = 'channelDelete' as const;

    public constructor(private readonly snapshots: GuildSnapshotEventSynchronizer) {
        super();
    }

    public async listener(channel: DMChannel | NonThreadGuildBasedChannel): Promise<void> {
        if ('guild' in channel) await this.snapshots.synchronizeGuild(channel.guild, 'channel-delete');
    }
}

export class GuildSnapshotChannelUpdateEvent extends EventBase<'channelUpdate'> {
    public eventName = 'channelUpdate' as const;

    public constructor(private readonly snapshots: GuildSnapshotEventSynchronizer) {
        super();
    }

    public async listener(_oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel): Promise<void> {
        if ('guild' in newChannel) await this.snapshots.synchronizeGuild(newChannel.guild, 'channel-update');
    }
}
