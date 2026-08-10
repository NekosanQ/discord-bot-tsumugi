import {
    judgeRockPaperScissors,
    type RockPaperScissorsHand,
    type RockPaperScissorsResult,
    selectRockPaperScissorsHand
} from '../../../domain/fun/rps/RockPaperScissors.js';
import type { RandomSource } from '../RandomSource.js';

export class PlayRockPaperScissors {
    public constructor(private readonly randomSource: RandomSource) {}

    public execute(userHand: RockPaperScissorsHand): RockPaperScissorsResult {
        return judgeRockPaperScissors(userHand, selectRockPaperScissorsHand(this.randomSource.next()));
    }
}
