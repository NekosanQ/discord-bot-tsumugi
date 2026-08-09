import type { KeywordScope } from '../../../../application/keyword/KeywordRepository.js';
import { createKeyword, type Keyword } from '../../../../domain/keyword/Keyword.js';

interface CacheDocument {
    schemaVersion: 1;
    keywords: { trigger: string; responses: string[] }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function encodeKeywordCache(keywords: readonly Keyword[]): string {
    const document: CacheDocument = {
        schemaVersion: 1,
        keywords: keywords.map((keyword) => ({ trigger: keyword.trigger, responses: [...keyword.responses] }))
    };
    return JSON.stringify(document);
}

export function decodeKeywordCache(value: string, scope: KeywordScope): Keyword[] {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.keywords)) {
        throw new TypeError('Keyword cache documentが不正です。');
    }

    return parsed.keywords.map((entry): Keyword => {
        if (!isRecord(entry) || typeof entry.trigger !== 'string' || !Array.isArray(entry.responses)) {
            throw new TypeError('Keyword cache entryが不正です。');
        }
        if (!entry.responses.every((response): response is string => typeof response === 'string')) {
            throw new TypeError('Keyword cache responsesが不正です。');
        }
        return createKeyword({ ...scope, trigger: entry.trigger, responses: entry.responses });
    });
}
