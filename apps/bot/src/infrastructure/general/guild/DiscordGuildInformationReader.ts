import { ChannelType, Client, NonThreadGuildBasedChannel } from 'discord.js';

import type {
    GuildChannelKind,
    GuildChannelSnapshot,
    GuildInformationReader,
    GuildInformationSnapshot
} from '../../../application/general/guild/GuildInformationReader.js';

function channelKind(channel: NonThreadGuildBasedChannel): GuildChannelKind {
    switch (channel.type) {
        case ChannelType.GuildCategory:
            return 'category';
        case ChannelType.GuildText:
            return 'text';
        case ChannelType.GuildVoice:
            return 'voice';
        case ChannelType.GuildAnnouncement:
            return 'announcement';
        case ChannelType.GuildStageVoice:
            return 'stage';
        default:
            return 'other';
    }
}

export class DiscordGuildInformationReader implements GuildInformationReader {
    public constructor(private readonly client: Client) {}

    public async read(guildId: string): Promise<GuildInformationSnapshot> {
        const guild = await this.client.guilds.fetch(guildId);
        const [channels, members, roles, emojis, stickers, soundboardSounds, owner] = await Promise.all([
            guild.channels.fetch(),
            guild.members.fetch(),
            guild.roles.fetch(),
            guild.emojis.fetch(),
            guild.stickers.fetch(),
            guild.soundboardSounds.fetch(),
            guild.fetchOwner()
        ]);

        const channelSnapshots: GuildChannelSnapshot[] = [];
        for (const channel of channels.values()) {
            if (!channel) continue;
            const kind = channelKind(channel);
            channelSnapshots.push({
                kind,
                visibleToEveryone: kind === 'category' || channel.permissionsFor(guild.roles.everyone).has('ViewChannel')
            });
        }

        return {
            id: guild.id,
            name: guild.name,
            description: guild.description,
            createdAt: guild.createdAt,
            iconUrl: guild.iconURL(),
            ownerId: owner.id,
            ownerMention: owner.toString(),
            memberCount: guild.memberCount,
            members: members.map((member) => ({ isBot: member.user.bot })),
            premiumSubscriptionCount: guild.premiumSubscriptionCount ?? 0,
            premiumTier: guild.premiumTier,
            channels: channelSnapshots,
            emojis: emojis.map((emoji) => ({ animated: emoji.animated })),
            stickerCount: stickers.size,
            soundboardCount: soundboardSounds.size,
            roles: roles.map((role) => ({ id: role.id, mention: role.toString(), position: role.position }))
        };
    }
}
