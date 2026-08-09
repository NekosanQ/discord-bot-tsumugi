import type { Keyword } from '../../domain/keyword/Keyword.js';
import type { KeywordScope } from './KeywordRepository.js';

export interface KeywordLookupCache {
    get: (scope: KeywordScope) => Promise<readonly Keyword[] | undefined>;
    set: (scope: KeywordScope, keywords: readonly Keyword[]) => Promise<void>;
    invalidate: (scope: KeywordScope) => Promise<void>;
}
