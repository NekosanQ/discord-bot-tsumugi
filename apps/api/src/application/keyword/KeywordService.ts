import { createKeyword, type Keyword } from '../../domain/keyword/Keyword.js';
import { KeywordNotFoundError } from './KeywordApplicationErrors.js';
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
    random?: () => number;
}

function compareKeywords(left: Keyword, right: Keyword): number {
    const lengthDifference = right.trigger.length - left.trigger.length;
    return lengthDifference !== 0 ? lengthDifference : left.trigger.localeCompare(right.trigger, 'ja');
}

export class KeywordService {
    private readonly random: () => number;

    public constructor(
        private readonly repository: KeywordRepository,
        options: KeywordServiceOptions = {}
    ) {
        this.random = options.random ?? Math.random;
    }

    public async save(command: SaveKeywordCommand): Promise<Keyword> {
        const keyword = createKeyword(command);
        await this.repository.save(keyword);
        return keyword;
    }

    public async remove(scope: KeywordScope, trigger: string): Promise<void> {
        const removed = await this.repository.remove(scope, trigger);
        if (!removed) throw new KeywordNotFoundError(trigger);
    }

    public async get(scope: KeywordScope, trigger: string): Promise<Keyword> {
        const keyword = await this.repository.findByTrigger(scope, trigger);
        if (!keyword) throw new KeywordNotFoundError(trigger);
        return keyword;
    }

    public async list(scope: KeywordScope): Promise<Keyword[]> {
        const keywords = await this.repository.list(scope);
        return [...keywords].sort((left, right) => left.trigger.localeCompare(right.trigger, 'ja'));
    }

    public async resolve(scope: KeywordScope, content: string): Promise<ResolvedKeyword | undefined> {
        const keywords = [...(await this.repository.list(scope))].sort(compareKeywords);
        const matched = keywords.find((keyword) => content.includes(keyword.trigger));
        if (!matched) return undefined;

        const index = Math.min(Math.floor(this.random() * matched.responses.length), matched.responses.length - 1);
        return { trigger: matched.trigger, response: matched.responses[index] };
    }
}
