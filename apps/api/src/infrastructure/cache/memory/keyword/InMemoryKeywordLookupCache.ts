import type { KeywordLookupCache } from '../../../../application/keyword/KeywordLookupCache.js';
import type { KeywordScope } from '../../../../application/keyword/KeywordRepository.js';
import type { Keyword } from '../../../../domain/keyword/Keyword.js';

interface CacheEntry {
    expiresAt: number;
    keywords: readonly Keyword[];
}

export interface InMemoryKeywordLookupCacheOptions {
    ttlMs: number;
    maxEntries: number;
    now?: () => number;
}

export class InMemoryKeywordLookupCache implements KeywordLookupCache {
    private readonly entries = new Map<string, CacheEntry>();
    private readonly now: () => number;

    public constructor(private readonly options: InMemoryKeywordLookupCacheOptions) {
        if (!Number.isInteger(options.ttlMs) || options.ttlMs < 1) throw new RangeError('ttlMsは1以上の整数である必要があります。');
        if (!Number.isInteger(options.maxEntries) || options.maxEntries < 1) {
            throw new RangeError('maxEntriesは1以上の整数である必要があります。');
        }
        this.now = options.now ?? Date.now;
    }

    public get(scope: KeywordScope): Promise<readonly Keyword[] | undefined> {
        const key = this.key(scope);
        const entry = this.entries.get(key);
        if (!entry) return Promise.resolve(undefined);
        if (entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return Promise.resolve(undefined);
        }

        this.entries.delete(key);
        this.entries.set(key, entry);
        return Promise.resolve(entry.keywords);
    }

    public set(scope: KeywordScope, keywords: readonly Keyword[]): Promise<void> {
        const key = this.key(scope);
        this.entries.delete(key);
        this.entries.set(key, { expiresAt: this.now() + this.options.ttlMs, keywords: [...keywords] });

        while (this.entries.size > this.options.maxEntries) {
            const oldestKey = this.entries.keys().next().value;
            if (oldestKey === undefined) break;
            this.entries.delete(oldestKey);
        }
        return Promise.resolve();
    }

    public invalidate(scope: KeywordScope): Promise<void> {
        this.entries.delete(this.key(scope));
        return Promise.resolve();
    }

    private key(scope: KeywordScope): string {
        return `${scope.guildId}:${scope.channelId}`;
    }
}
