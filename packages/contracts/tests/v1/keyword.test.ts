import assert from 'node:assert/strict';
import test from 'node:test';

import { ContractValidationError, parseKeywordListResponse, parseSaveKeywordRequest } from '../../src/index.js';

void test('keyword requestを実行時検証する', () => {
    assert.deepEqual(parseSaveKeywordRequest({ guildId: '1', channelId: '2', trigger: '猫', responses: ['にゃー'] }), {
        guildId: '1',
        channelId: '2',
        trigger: '猫',
        responses: ['にゃー']
    });
    assert.throws(() => parseSaveKeywordRequest({ guildId: '1', channelId: '2', trigger: '猫', responses: [1] }), ContractValidationError);
});

void test('keyword responseを実行時検証する', () => {
    assert.equal(parseKeywordListResponse({ keywords: [] }).keywords.length, 0);
    assert.throws(() => parseKeywordListResponse({ keywords: {} }), ContractValidationError);
});
