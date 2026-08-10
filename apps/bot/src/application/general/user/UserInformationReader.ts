export interface UserInformationSnapshot {
    userId: string;
    username: string;
    globalName: string | null;
    isBot: boolean;
    avatarUrl: string;
    createdAt: Date;
    nickname: string | null;
    joinedAt: Date | null;
    presenceStatus: string;
    permissionBitfield: bigint;
    roleMentions: readonly string[];
    roleCount: number;
}

export interface UserInformationReader {
    read: (guildId: string, userId: string) => Promise<UserInformationSnapshot>;
}
