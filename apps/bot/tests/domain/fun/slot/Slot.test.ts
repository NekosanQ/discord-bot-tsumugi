import assert from 'node:assert/strict';
import test from 'node:test';

import { spinSlot } from '../../../../src/domain/fun/slot/Slot.js';

void test('乱数値は従来のリール順序で絵柄へ変換される', (): void => {
    const result = spinSlot([0, 1 / 7, 2 / 7]);
    assert.deepEqual(result.reels, ['7️⃣', '🍒', '🍋']);
    assert.equal(result.outcome, 'none');
});

void test('3個一致・2個一致・不一致を区別する', (): void => {
    assert.equal(spinSlot([0, 0, 0]).outcome, 'jackpot');
    assert.equal(spinSlot([0, 0, 0.5]).outcome, 'nearMiss');
    assert.equal(spinSlot([0, 0.2, 0.4]).outcome, 'none');
});
