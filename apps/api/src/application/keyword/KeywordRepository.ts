import type { Keyword } from '../../domain/keyword/Keyword.js';

export interface KeywordScope {
    guildId: string;
    channelId: string;
}

export interface KeywordRepository {
    save: (keyword: Keyword) => Promise<void>;
    remove: (scope: KeywordScope, trigger: string) => Promise<boolean>;
    findByTrigger: (scope: KeywordScope, trigger: string) => Promise<Keyword | undefined>;
    list: (scope: KeywordScope) => Promise<Keyword[]>;
}
