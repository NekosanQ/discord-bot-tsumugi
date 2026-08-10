export const ROCK_PAPER_SCISSORS_HANDS = ['rock', 'scissors', 'paper'] as const;

export type RockPaperScissorsHand = (typeof ROCK_PAPER_SCISSORS_HANDS)[number];
export type RockPaperScissorsOutcome = 'win' | 'lose' | 'draw';

export interface RockPaperScissorsResult {
    userHand: RockPaperScissorsHand;
    botHand: RockPaperScissorsHand;
    outcome: RockPaperScissorsOutcome;
}

const WINS_AGAINST: Record<RockPaperScissorsHand, RockPaperScissorsHand> = {
    rock: 'scissors',
    scissors: 'paper',
    paper: 'rock'
};

export function selectRockPaperScissorsHand(randomValue: number): RockPaperScissorsHand {
    return ROCK_PAPER_SCISSORS_HANDS[Math.floor(randomValue * ROCK_PAPER_SCISSORS_HANDS.length)] ?? ROCK_PAPER_SCISSORS_HANDS[0];
}

/** ユーザーとBotの手だけを入力として勝敗を決定する。 */
export function judgeRockPaperScissors(userHand: RockPaperScissorsHand, botHand: RockPaperScissorsHand): RockPaperScissorsResult {
    let outcome: RockPaperScissorsOutcome = 'lose';
    if (userHand === botHand) {
        outcome = 'draw';
    } else if (WINS_AGAINST[userHand] === botHand) {
        outcome = 'win';
    }

    return { userHand, botHand, outcome };
}
