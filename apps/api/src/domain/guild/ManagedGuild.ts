import { KeywordValidationError } from '../keyword/KeywordErrors.js';

export interface ManagedGuild {
    readonly id: string;
    readonly botInstalled: boolean;
}

export function createManagedGuild(id: string, botInstalled: boolean): ManagedGuild {
    if (!/^\d{17,20}$/.test(id)) throw new KeywordValidationError('guildId', 'guildIdはDiscord snowflake形式である必要があります。');
    return Object.freeze({ id, botInstalled });
}
