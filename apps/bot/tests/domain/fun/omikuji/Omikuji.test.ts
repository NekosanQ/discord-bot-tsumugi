import assert from 'node:assert/strict';
import test from 'node:test';

import { drawOmikuji } from '../../../../src/domain/fun/omikuji/Omikuji.js';

void test('おみくじは従来の重み境界で運勢を選ぶ', (): void => {
    const cases = [
        { randomValue: 0, expected: '大吉' },
        { randomValue: 0.2, expected: '中吉' },
        { randomValue: 0.35, expected: '小吉' },
        { randomValue: 0.5, expected: '吉' },
        { randomValue: 0.7, expected: '末吉' },
        { randomValue: 0.9, expected: '凶' },
        { randomValue: 0.98, expected: '大凶' }
    ] as const;

    for (const testCase of cases) {
        const result = drawOmikuji({
            fortune: testCase.randomValue,
            hope: 0,
            lostItem: 0,
            learning: 0,
            conflict: 0,
            love: 0,
            disease: 0
        });
        assert.equal(result.fortune, testCase.expected);
    }
});

void test('各項目は入力された乱数値から決定される', (): void => {
    assert.deepEqual(
        drawOmikuji({
            fortune: 0,
            hope: 0,
            lostItem: 0,
            learning: 0,
            conflict: 0,
            love: 0,
            disease: 0
        }),
        {
            fortune: '大吉',
            hope: '叶う',
            lostItem: '出る',
            learning: '安心して勉学せよ',
            conflict: '勝てる 油断禁物',
            love: 'この人を逃すな',
            disease: '信じろ なおる'
        }
    );

    assert.deepEqual(
        drawOmikuji({
            fortune: 0.999,
            hope: 0.999,
            lostItem: 0.999,
            learning: 0.999,
            conflict: 0.999,
            love: 0.999,
            disease: 0.999
        }),
        {
            fortune: '大凶',
            hope: '叶わない事ありけり',
            lostItem: '出にくい',
            learning: '自己の甘えを捨てよ',
            conflict: '自己の甘えを捨てよ',
            love: '日頃の行いによりけり',
            disease: '日頃の行いによりけり'
        }
    );
});
