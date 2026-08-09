import { createKeyword, type Keyword } from '../../domain/keyword/Keyword.js';
import { KeywordNotFoundError } from './KeywordApplicationErrors.js';
import type { KeywordLookupCache } from './KeywordLookupCache.js';
import type { KeywordRepository, KeywordScope } from './KeywordRepository.js';

export interface SaveKeywordCommand extends KeywordScope {
    trigger: string;
    responses: readonly string[];
}

export interface ResolvedKeyword {
    trigger: string;
    response: string;
}

export interface KeywordServiceOptions {
    cache?: KeywordLookupCache;
    reportCacheError?: (operation: 'get' | 'set' | 'invalidate', error: unknown) => void;
    random?: () => number;
}

function compareKeywords(left: Keyword, right: Keyword): number {
    const lengthDifference = right.trigger.length - left.trigger.length;
    return lengthDifference !== 0 ? lengthDifference : left.trigger.localeCompare(right.trigger, 'ja');
}

export class KeywordService {
    private readonly cache: KeywordLookupCache | undefined;
    private readonly random: () => number;
    private readonly reportCacheError: (operation: 'get' | 'set' | 'invalidate', error: unknown) => void;

    public constructor(
        private readonly repository: KeywordRepository,
        options: KeywordServiceOptions = {}
    ) {
        this.cache = options.cache;
        this.random = options.random ?? Math.random;
        this.reportCacheError = options.reportCacheError ?? ((): void => undefined);
    }

    public async save(command: SaveKeywordCommand): Promise<Keyword> {
        const keyword = createKeyword(command);
        await this.repository.save(keyword);
        await this.invalidateCache(keyword);
        return keyword;
    }

    public async remove(scope: KeywordScope, trigger: string): Promise<void> {
        const removed = await this.repository.remove(scope, trigger);
        if (!removed) throw new KeywordNotFoundError(trigger);
        await this.invalidateCache(scope);
    }

    public async get(scope: KeywordScope, trigger: string): Promise<Keyword> {
        const keyword = await this.repository.findByTrigger(scope, trigger);
        if (!keyword) throw new KeywordNotFoundError(trigger);
        return keyword;
    }

    public async list(scope: KeywordScope): Promise<Keyword[]> {
        const keywords = await this.listWithCache(scope);
        return [...keywords].sort((left, right) => left.trigger.localeCompare(right.trigger, 'ja'));
    }

    public async resolve(scope: KeywordScope, content: string): Promise<ResolvedKeyword | undefined> {
        const keywords = [...(await this.listWithCache(scope))].sort(compareKeywords);
        const matched = keywords.find((keyword) => content.includes(keyword.trigger));
        if (!matched) return undefined;

        const index = Math.min(Math.floor(this.random() * matched.responses.length), matched.responses.length - 1);
        return { trigger: matched.trigger, response: matched.responses[index] };
    }

    private async listWithCache(scope: KeywordScope): Promise<readonly Keyword[]> {
        if (this.cache) {
            try {
                const cached = await this.cache.get(scope);
                if (cached !== undefined) return cached;
            } catch (error) {
                this.reportCacheError('get', error);
            }
        }

        const keywords = await this.repository.list(scope);
        if (this.cache) {
            try {
                await this.cache.set(scope, keywords);
            } catch (error) {
                this.reportCacheError('set', error);
            }
        }
        return keywords;
    }

    private async invalidateCache(scope: KeywordScope): Promise<void> {
        if (!this.cache) return;
        try {
            await this.cache.invalidate(scope);
        } catch (error) {
            this.reportCacheError('invalidate', error);
        }
    }
}
