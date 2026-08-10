export type GuildChannelKind = 'category' | 'text' | 'voice' | 'announcement' | 'stage' | 'other';

export interface GuildChannelSnapshot {
    kind: GuildChannelKind;
    visibleToEveryone: boolean;
}

export interface GuildRoleSnapshot {
    id: string;
    mention: string;
    position: number;
}

export interface GuildInformationSnapshot {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    iconUrl: string | null;
    ownerId: string;
    ownerMention: string;
    memberCount: number;
    members: readonly { isBot: boolean }[];
    premiumSubscriptionCount: number;
    premiumTier: number;
    channels: readonly GuildChannelSnapshot[];
    emojis: readonly { animated: boolean }[];
    stickerCount: number;
    soundboardCount: number;
    roles: readonly GuildRoleSnapshot[];
}

export interface GuildInformationReader {
    read: (guildId: string) => Promise<GuildInformationSnapshot>;
}
