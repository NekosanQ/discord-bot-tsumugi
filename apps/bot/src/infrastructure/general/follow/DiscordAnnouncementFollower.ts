import { ChannelType, Client } from 'discord.js';

import type { AnnouncementFollower } from '../../../application/general/follow/AnnouncementFollower.js';

export class DiscordAnnouncementFollower implements AnnouncementFollower {
    public constructor(
        private readonly client: Client,
        private readonly announcementChannelId: string
    ) {}

    public async follow(destinationChannelId: string): Promise<boolean> {
        const announcementChannel = await this.client.channels.fetch(this.announcementChannelId);
        if (announcementChannel?.type !== ChannelType.GuildAnnouncement) return false;
        await announcementChannel.addFollower(destinationChannelId);
        return true;
    }
}
