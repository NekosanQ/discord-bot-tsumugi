export class InvalidKeywordPersistenceDataError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'InvalidKeywordPersistenceDataError';
    }
}

export function decodeKeywordResponses(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new InvalidKeywordPersistenceDataError('Keyword.responsesは空でない文字列配列である必要があります。');
    }

    const responses: string[] = [];
    for (const response of value) {
        if (typeof response !== 'string' || response.trim() === '') {
            throw new InvalidKeywordPersistenceDataError('Keyword.responsesは空でない文字列配列である必要があります。');
        }
        responses.push(response);
    }
    return responses;
}
