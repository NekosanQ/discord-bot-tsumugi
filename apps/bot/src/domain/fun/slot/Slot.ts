export const SLOT_REELS = ['7️⃣', '🍒', '🍋', '🔔', '🍉', '⭐', '💎'] as const;

export type SlotReel = (typeof SLOT_REELS)[number];
export type SlotOutcome = 'jackpot' | 'nearMiss' | 'none';

export interface SlotResult {
    reels: readonly [SlotReel, SlotReel, SlotReel];
    outcome: SlotOutcome;
}

function selectReel(randomValue: number): SlotReel {
    return SLOT_REELS[Math.floor(randomValue * SLOT_REELS.length)] ?? SLOT_REELS[0];
}

/** 3つの乱数値だけを入力としてスロット結果を決定する。 */
export function spinSlot(randomValues: readonly [number, number, number]): SlotResult {
    const reels: SlotResult['reels'] = [selectReel(randomValues[0]), selectReel(randomValues[1]), selectReel(randomValues[2])];
    const [first, second, third] = reels;

    let outcome: SlotOutcome = 'none';
    if (first === second && second === third) {
        outcome = 'jackpot';
    } else if (first === second || second === third || first === third) {
        outcome = 'nearMiss';
    }

    return { reels, outcome };
}
