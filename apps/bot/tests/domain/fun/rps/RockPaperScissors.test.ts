import assert from 'node:assert/strict';
import test from 'node:test';

import { judgeRockPaperScissors, selectRockPaperScissorsHand } from '../../../../src/domain/fun/rps/RockPaperScissors.js';

void test('乱数値は従来の順序でBotの手へ変換される', (): void => {
    assert.equal(selectRockPaperScissorsHand(0), 'rock');
    assert.equal(selectRockPaperScissorsHand(1 / 3), 'scissors');
    assert.equal(selectRockPaperScissorsHand(2 / 3), 'paper');
    assert.equal(selectRockPaperScissorsHand(0.999), 'paper');
});

void test('ユーザー視点で勝ち・負け・あいこを判定する', (): void => {
    assert.equal(judgeRockPaperScissors('rock', 'scissors').outcome, 'win');
    assert.equal(judgeRockPaperScissors('rock', 'paper').outcome, 'lose');
    assert.equal(judgeRockPaperScissors('rock', 'rock').outcome, 'draw');
});
