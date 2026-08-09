import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    decodeKeywordResponses,
    InvalidKeywordPersistenceDataError
} from '../../../../../src/infrastructure/persistence/prisma/keyword/keywordJsonCodec.js';

void describe('decodeKeywordResponses', () => {
    void it('文字列配列を複製して返す', () => {
        const source = ['a', 'b'];
        const decoded = decodeKeywordResponses(source);

        assert.deepEqual(decoded, source);
        assert.notEqual(decoded, source);
    });

    for (const invalidValue of [null, 'response', [], ['ok', 1], ['']]) {
        void it(`不正な永続化値を拒否する: ${JSON.stringify(invalidValue)}`, () => {
            assert.throws(() => decodeKeywordResponses(invalidValue), InvalidKeywordPersistenceDataError);
        });
    }
});
