import type { Clock } from '../Clock.js';
import type { BotInformationReader } from './BotInformationReader.js';

export interface BotInformation {
    username: string;
    version: string;
    createdAt: Date;
    guildCount: string;
    userCount: string;
}

export class GetBotInformation {
    public constructor(
        private readonly reader: BotInformationReader,
        private readonly clock: Clock
    ) {}

    public execute(): BotInformation {
        const snapshot = this.reader.read();
        return {
            username: snapshot.username,
            version: snapshot.version,
            createdAt: snapshot.createdAt ?? this.clock.now(),
            guildCount: String(snapshot.guildCount),
            userCount: String(snapshot.userCount)
        };
    }
}
