import assert from 'node:assert/strict';
import test from 'node:test';

import type { Delay } from '../../../src/application/fun/Delay.js';
import { DrawOmikuji } from '../../../src/application/fun/omikuji/DrawOmikuji.js';
import type { RandomSource } from '../../../src/application/fun/RandomSource.js';
import { PlayRockPaperScissors } from '../../../src/application/fun/rps/PlayRockPaperScissors.js';
import { SpinSlot } from '../../../src/application/fun/slot/SpinSlot.js';

class SequenceRandomSource implements RandomSource {
    private index = 0;

    public constructor(
        private readonly values: readonly number[],
        private readonly calls?: string[]
    ) {}

    public next(): number {
        const value = this.values.at(this.index);
        this.index++;
        if (value === undefined) throw new Error('テスト用乱数が不足しています。');
        this.calls?.push(`random:${String(value)}`);
        return value;
    }
}

void test('DrawOmikujiは7項目分の乱数を明示したsourceから順番に取得する', (): void => {
    const drawOmikuji = new DrawOmikuji(new SequenceRandomSource([0, 0.999, 0, 0.999, 0, 0.999, 0]));

    assert.deepEqual(drawOmikuji.execute(), {
        fortune: '大吉',
        hope: '叶わない事ありけり',
        lostItem: '出る',
        learning: '自己の甘えを捨てよ',
        conflict: '勝てる 油断禁物',
        love: '日頃の行いによりけり',
        disease: '信じろ なおる'
    });
});

void test('PlayRockPaperScissorsは注入した乱数sourceでBotの手を決める', (): void => {
    const play = new PlayRockPaperScissors(new SequenceRandomSource([0.5]));
    assert.deepEqual(play.execute('rock'), { userHand: 'rock', botHand: 'scissors', outcome: 'win' });
});

void test('SpinSlotは注入した待機処理の完了後に乱数を取得する', async (): Promise<void> => {
    const calls: string[] = [];
    const delay: Delay = {
        wait: (milliseconds: number): Promise<void> => {
            calls.push(`wait:${String(milliseconds)}`);
            return Promise.resolve();
        }
    };
    const spinSlot = new SpinSlot(new SequenceRandomSource([0, 0, 0], calls), delay);

    assert.deepEqual(await spinSlot.execute(), { reels: ['7️⃣', '7️⃣', '7️⃣'], outcome: 'jackpot' });
    assert.deepEqual(calls, ['wait:1500', 'random:0', 'random:0', 'random:0']);
});
