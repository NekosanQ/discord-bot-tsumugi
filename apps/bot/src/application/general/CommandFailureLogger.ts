export type CommandFailureOperation = 'bot-information' | 'guild-information' | 'user-member-fetch';

export interface CommandFailureLogger {
    failure: (operation: CommandFailureOperation, error: unknown) => void;
}
