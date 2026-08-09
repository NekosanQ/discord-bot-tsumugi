export interface KeywordScope {
    guildId: string;
    channelId: string;
}

export interface KeywordRecord extends KeywordScope {
    trigger: string;
    responses: string[];
}

export interface KeywordManagement {
    save: (keyword: KeywordRecord) => Promise<void>;
    remove: (scope: KeywordScope, trigger: string) => Promise<void>;
    get: (scope: KeywordScope, trigger: string) => Promise<KeywordRecord>;
    list: (scope: KeywordScope) => Promise<KeywordRecord[]>;
    resolve: (scope: KeywordScope, content: string) => Promise<{ trigger: string; response: string } | undefined>;
}
