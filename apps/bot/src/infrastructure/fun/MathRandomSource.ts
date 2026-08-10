import type { RandomSource } from '../../application/fun/RandomSource.js';

export class MathRandomSource implements RandomSource {
    public next(): number {
        return Math.random();
    }
}
