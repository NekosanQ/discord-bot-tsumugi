export type KeywordField = 'guildId' | 'channelId' | 'trigger' | 'responses';

export class KeywordValidationError extends Error {
    public constructor(
        public readonly field: KeywordField,
        message: string
    ) {
        super(message);
        this.name = 'KeywordValidationError';
    }
}
