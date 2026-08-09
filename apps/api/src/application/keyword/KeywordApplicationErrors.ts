export class KeywordNotFoundError extends Error {
    public constructor(public readonly trigger: string) {
        super(`キーワード「${trigger}」は見つかりませんでした。`);
        this.name = 'KeywordNotFoundError';
    }
}

export class ManagedChannelOwnershipError extends Error {
    public constructor(
        public readonly channelId: string,
        public readonly requestedGuildId: string
    ) {
        super('チャンネルは別のサーバーに所属しています。');
        this.name = 'ManagedChannelOwnershipError';
    }
}

export class KeywordDependencyError extends Error {
    public constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'KeywordDependencyError';
    }
}
