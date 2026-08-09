import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createKeyword, parseResponsesText } from '../../../src/domain/keyword/Keyword.js';
import { KeywordValidationError } from '../../../src/domain/keyword/KeywordErrors.js';

const guildId = '12345678901234567';
const channelId = '22345678901234567';

void describe('Keyword', () => {
    void it('Discord入力から空行を除いて応答を作る', () => {
        assert.deepEqual(parseResponsesText('こんにちは\n\n  \nやあ'), ['こんにちは', 'やあ']);
    });

    void it('有効な値から不変なKeywordを作る', () => {
        const keyword = createKeyword({ guildId, channelId, trigger: '猫', responses: ['にゃー'] });

        assert.deepEqual(keyword, { guildId, channelId, trigger: '猫', responses: ['にゃー'] });
        assert.equal(Object.isFrozen(keyword), true);
        assert.equal(Object.isFrozen(keyword.responses), true);
    });

    void it('メンションを含む応答を拒否する', () => {
        assert.throws(
            () => createKeyword({ guildId, channelId, trigger: '猫', responses: ['<@12345678901234567>'] }),
            (error: unknown) => error instanceof KeywordValidationError && error.field === 'responses'
        );
    });

    void it('Discord tokenらしい応答を拒否する', () => {
        const tokenLikeValue = `${'a'.repeat(24)}.${'b'.repeat(6)}.${'c'.repeat(27)}`;
        assert.throws(() => createKeyword({ guildId, channelId, trigger: '猫', responses: [tokenLikeValue] }), KeywordValidationError);
    });

    void it('不正なsnowflakeと空の応答を拒否する', () => {
        assert.throws(() => createKeyword({ guildId: 'guild', channelId, trigger: '猫', responses: ['にゃー'] }), KeywordValidationError);
        assert.throws(() => createKeyword({ guildId, channelId, trigger: '猫', responses: [] }), KeywordValidationError);
    });
});
