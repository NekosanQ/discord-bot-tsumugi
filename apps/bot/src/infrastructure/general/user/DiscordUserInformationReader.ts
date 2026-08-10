import { Client } from 'discord.js';

import type { UserInformationReader, UserInformationSnapshot } from '../../../application/general/user/UserInformationReader.js';

export class DiscordUserInformationReader implements UserInformationReader {
    public constructor(private readonly client: Client) {}

    public async read(guildId: string, userId: string): Promise<UserInformationSnapshot> {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild is not available in the client cache.');

        const member = await guild.members.fetch(userId);
        return {
            userId: member.user.id,
            username: member.user.username,
            globalName: member.user.globalName,
            isBot: member.user.bot,
            avatarUrl: member.user.displayAvatarURL(),
            createdAt: member.user.createdAt,
            nickname: member.nickname,
            joinedAt: member.joinedAt,
            presenceStatus: member.presence?.status ?? 'offline',
            permissionBitfield: member.permissions.bitfield,
            roleMentions: member.roles.cache.filter((role) => role.id !== guild.id).map((role) => role.toString()),
            roleCount: member.roles.cache.size - 1
        };
    }
}
