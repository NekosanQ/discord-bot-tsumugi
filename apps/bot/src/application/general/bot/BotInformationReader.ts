export interface BotInformationSnapshot {
    username: string;
    version: string;
    createdAt?: Date;
    guildCount: number;
    userCount: number;
}

export interface BotInformationReader {
    read: () => BotInformationSnapshot;
}
